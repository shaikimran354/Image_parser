import os
import re
import json
from PIL import Image
from google import genai
from google.genai import types
from typing import Dict, Any
from app.utils.helpers import get_env
from rapidfuzz import fuzz

class LLMService:
    def __init__(self):
        # Fetch configuration variables
        self.provider = get_env("LLM_PROVIDER", "gemini")
        self.model_name = get_env("MODEL_NAME", "gemini-3.5-flash")
        
        # Initialize Google GenAI client
        api_key = get_env("GEMINI_API_KEY")
        if not api_key or api_key == "your_api_key_here":
            print("[LLMService] WARNING: GEMINI_API_KEY is not set in .env!", flush=True)
            self.client = None
        else:
            self.client = genai.Client(api_key=api_key)
        
        print(f"[LLMService] Using model: '{self.model_name}'", flush=True)

    def _get_system_prompt(self) -> str:
        base_prompt = ""
        paths_to_try = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../invoice_prompt.txt")),
        ]
        
        for path in paths_to_try:
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        base_prompt = f.read().strip()
                    break
                except Exception:
                    pass

        if not base_prompt:
            base_prompt = "Extract all invoice details from the text carefully and return as JSON."
            
        return base_prompt

    def _dynamic_confidence_check(self, json_obj: Any, normalized_ocr: str, field_matches: dict, path: str = ""):
        if isinstance(json_obj, dict):
            for k, v in json_obj.items():
                new_path = f"{path}.{k}" if path else k
                self._dynamic_confidence_check(v, normalized_ocr, field_matches, new_path)
        elif isinstance(json_obj, list):
            for i, item in enumerate(json_obj):
                new_path = f"{path}[{i}]"
                self._dynamic_confidence_check(item, normalized_ocr, field_matches, new_path)
        else:
            if json_obj is None or str(json_obj).strip() == "":
                return
            val_str = str(json_obj)
            norm_val = re.sub(r'[\W_]+', '', val_str.lower())
            
            if not norm_val:
                return
                
            if fuzz.partial_ratio(norm_val, normalized_ocr) > 85:
                field_matches[path] = True
                return
            
            val_words = [re.sub(r'[\W_]+', '', w) for w in val_str.lower().split() if w]
            val_words = [w for w in val_words if w]
            if not val_words:
                return
                
            matched_words = sum(1 for w in val_words if fuzz.partial_ratio(w, normalized_ocr) > 85)
            if matched_words / len(val_words) >= 0.8:
                field_matches[path] = True
            else:
                field_matches[path] = False

    def extract_structured_invoice(self, extracted_text: str, model_name: str = None) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("GEMINI_API_KEY is missing. Please add it to the backend/.env file.")

        system_prompt = self._get_system_prompt()

        try:
            # Query Google Gemini API with retries
            max_retries = 2
            base_delay = 3
            
            for attempt in range(max_retries):
                try:
                    response = self.client.models.generate_content(
                        model=model_name or self.model_name,
                        contents=f"{system_prompt}\n\nHere is the raw extracted invoice text:\n\n{extracted_text}",
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.0
                        )
                    )
                    break
                except Exception as e:
                    if ("503" in str(e) or "429" in str(e)) and attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        import time
                        time.sleep(delay)
                    else:
                        raise e

            content = response.text.strip()
            
            # Parse arbitrary JSON
            try:
                receipt = json.loads(content)
            except json.JSONDecodeError:
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    receipt = json.loads(json_match.group())
                else:
                    raise ValueError(f"Could not find JSON in LLM response: {content}")
            
            # Confidence Scoring dynamically on all strings
            field_matches = {}
            normalized_ocr = re.sub(r'[\W_]+', '', extracted_text.lower())
            self._dynamic_confidence_check(receipt, normalized_ocr, field_matches)
            
            total_checked = len(field_matches)
            text_match_score = sum(1 for v in field_matches.values() if v) / total_checked if total_checked > 0 else 1.0
            
            receipt["confidence_details"] = {
                "math_confidence": None,
                "text_match_confidence": text_match_score,
                "field_matches": field_matches
            }
            
            return receipt
            
        except Exception as e:
            raise RuntimeError(f"Gemini extraction failed: {str(e)}")


    def extract_from_images(self, image_paths: list[str], model_name: str = None) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("GEMINI_API_KEY is missing. Please add it to the backend/.env file.")

        system_prompt = self._get_system_prompt()

        try:
            image_parts = []
            for img_path in image_paths:
                img = Image.open(img_path)
                image_parts.append(img)
        except Exception as e:
            raise RuntimeError(f"Failed to load images for Gemini: {str(e)}")

        try:
            max_retries = 2
            base_delay = 3
            contents_list = [system_prompt] + image_parts
            
            for attempt in range(max_retries):
                try:
                    response = self.client.models.generate_content(
                        model=model_name or self.model_name,
                        contents=contents_list,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.0
                        )
                    )
                    break
                except Exception as e:
                    if ("503" in str(e) or "429" in str(e)) and attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        import time
                        time.sleep(delay)
                    else:
                        raise e

            content = response.text.strip()
            
            try:
                receipt = json.loads(content)
            except json.JSONDecodeError:
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    receipt = json.loads(json_match.group())
                else:
                    raise ValueError(f"Could not find JSON in LLM response: {content}")
            
            # Text match confidence is inherently 1.0 for image-only pipeline
            receipt["confidence_details"] = {
                "math_confidence": None,
                "text_match_confidence": 1.0,
                "field_matches": {}
            }
            
            return receipt
            
        except Exception as e:
            raise RuntimeError(f"Gemini multimodal extraction failed: {str(e)}")
