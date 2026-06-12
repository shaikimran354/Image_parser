import os
import fitz  # PyMuPDF
from typing import List

class PDFService:
    @staticmethod
    def extract_text(pdf_path: str) -> str:
        """
        Extracts raw text from a digital PDF file using PyMuPDF.
        """
        text = ""
        try:
            with fitz.open(pdf_path) as doc:
                for page in doc:
                    extracted = page.get_text()
                    if extracted:
                        text += extracted + "\n"
        except Exception as e:
            raise RuntimeError(f"Error extracting text from PDF: {str(e)}")
        return text

    @staticmethod
    def convert_to_images(pdf_path: str, output_dir: str, zoom: float = 1.5) -> List[str]:
        """
        Converts all pages of a PDF to JPEG images for OCR.
        Saves images in output_dir and returns their file paths.
        """
        os.makedirs(output_dir, exist_ok=True)
        image_paths = []
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        
        try:
            with fitz.open(pdf_path) as doc:
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    # matrix for resolution zoom (higher zoom = better OCR, 1.5 is an optimal balance)
                    matrix = fitz.Matrix(zoom, zoom)
                    pix = page.get_pixmap(matrix=matrix)
                    
                    img_filename = f"{base_name}_page_{page_num + 1}.jpg"
                    img_path = os.path.join(output_dir, img_filename)
                    pix.save(img_path)
                    image_paths.append(img_path)
        except Exception as e:
            raise RuntimeError(f"Error converting PDF to images: {str(e)}")
            
        return image_paths

    @staticmethod
    def get_page_count(pdf_path: str) -> int:
        """
        Returns the total number of pages in the PDF.
        """
        try:
            with fitz.open(pdf_path) as doc:
                return len(doc)
        except Exception as e:
            raise RuntimeError(f"Error reading PDF page count: {str(e)}")

    @staticmethod
    def render_page_to_image(pdf_path: str, page_num: int, output_path: str, zoom: float = 2.0) -> str:
        """
        Renders a single PDF page (1-indexed) as a high-resolution image and saves it.
        """
        try:
            with fitz.open(pdf_path) as doc:
                if page_num < 1 or page_num > len(doc):
                    raise ValueError(f"Page number {page_num} is out of bounds (1-{len(doc)})")
                
                page = doc[page_num - 1]
                matrix = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=matrix)
                
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                pix.save(output_path)
        except Exception as e:
            raise RuntimeError(f"Error rendering PDF page to image: {str(e)}")
        return output_path

