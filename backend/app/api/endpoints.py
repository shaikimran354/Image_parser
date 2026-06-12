import os
import json
import shutil
import time
from fastapi import APIRouter, UploadFile, File, HTTPException, Response, Body, Query
from fastapi.responses import FileResponse
from typing import Dict, Any

from app.services.pdf_service import PDFService
from app.services.ocr_service import OCRService
from app.services.llm_service import LLMService
from app.services.export_service import ExportService
from app.services.schema_service import SchemaService
from app.utils.helpers import generate_unique_id

def _find_invoice_identifier(data: Dict[str, Any]) -> str:
    for key, value in data.items():
        k_lower = key.lower().replace("_", "")
        if "invoice" in k_lower and ("no" in k_lower or "num" in k_lower or "id" in k_lower):
            if isinstance(value, (str, int)):
                return str(value).replace('/', '-').replace('\\', '-')
    return "export"

router = APIRouter()

# Define storage directories
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../..", "uploads"))
IMAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../..", "images_temp"))
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../..", "data"))

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# Initialize singleton services
ocr_service = OCRService()
llm_service = LLMService()

@router.post("/upload/digital")
async def upload_digital(file: UploadFile = File(...), model: str = Query(None)):
    """
    Pipeline 1: Digital PDF.
    PyMuPDF Text Extract -> Gemini LLM Extract -> Map & Save -> Return ID + parsed invoice structure.
    """
    print(f"--- [API] /upload/digital hit: {file.filename} ---", flush=True)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported.")

    # Automatically clear any cached additional fields from previous invoices
    SchemaService.clear_custom_schema()

    t_start = time.perf_counter()
    invoice_id = generate_unique_id()
    pdf_path = os.path.join(UPLOAD_DIR, f"{invoice_id}.pdf")

    # 1. Save uploaded file
    t0 = time.perf_counter()
    try:
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    t_save = time.perf_counter() - t0

    # 2. Extract content using PyMuPDF
    t0 = time.perf_counter()
    try:
        extracted_text = PDFService.extract_text(pdf_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF pages: {str(e)}")
    t_extract = time.perf_counter() - t0

    if not extracted_text.strip():
        raise HTTPException(
            status_code=422,
            detail="The uploaded PDF is empty or machine-unreadable (possibly scanned). Try using the Scanned PDF workflow instead."
        )

    # 3. Running AI Analysis
    t0 = time.perf_counter()
    try:
        extracted_receipt = llm_service.extract_structured_invoice(extracted_text, model_name=model)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI extraction model failed: {str(e)}")
    t_ai = time.perf_counter() - t0

    # 4. Map & Save
    t0 = time.perf_counter()
    try:
        # Extract confidence details to save separately
        confidence_details = extracted_receipt.pop("confidence_details", None)
        
        # Store structured data locally
        data_path = os.path.join(DATA_DIR, f"{invoice_id}.json")
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(extracted_receipt, f, indent=4)
            
        # Store confidence data separately
        if confidence_details:
            conf_path = os.path.join(DATA_DIR, f"{invoice_id}_confidence.json")
            with open(conf_path, "w", encoding="utf-8") as f:
                json.dump(confidence_details, f, indent=4)
                
        # Re-attach for the immediate API response to UI
        if confidence_details:
            extracted_receipt["confidence_details"] = confidence_details
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save extracted invoice: {str(e)}")
    t_map_save = time.perf_counter() - t0
    t_total = time.perf_counter() - t_start

    print(f"--- [Digital Pipeline Metrics for {file.filename}] ---", flush=True)
    print(f"  Step 1: Save Uploaded File      : {t_save:.3f}s", flush=True)
    print(f"  Step 2: PyMuPDF Text Extract   : {t_extract:.3f}s", flush=True)
    print(f"  Step 3: Gemini LLM Extract     : {t_ai:.3f}s", flush=True)
    print(f"  Step 4: Map & Save Results     : {t_map_save:.3f}s", flush=True)
    print(f"  Total Elapsed Time             : {t_total:.3f}s", flush=True)

    return {"id": invoice_id, "data": extracted_receipt, "processing_time": t_total}


@router.post("/upload/scanned")
async def upload_scanned(file: UploadFile = File(...), model: str = Query(None)):
    """
    Pipeline 2: Scanned PDF.
    PyMuPDF Render Pages -> PaddleOCR Text Extract -> Gemini LLM Extract -> Map & Save -> Return ID + data.
    """
    print(f"--- [API] /upload/scanned hit: {file.filename} ---", flush=True)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported.")

    # Automatically clear any cached additional fields from previous invoices
    SchemaService.clear_custom_schema()

    t_start = time.perf_counter()
    invoice_id = generate_unique_id()
    pdf_path = os.path.join(UPLOAD_DIR, f"{invoice_id}.pdf")

    # 1. Save uploaded file
    t0 = time.perf_counter()
    try:
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    t_save = time.perf_counter() - t0

    # 2. Convert PDF pages to images
    t0 = time.perf_counter()
    try:
        page_images_dir = os.path.join(IMAGE_DIR, invoice_id)
        image_paths = PDFService.convert_to_images(pdf_path, page_images_dir)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render pages for OCR: {str(e)}")
    t_render = time.perf_counter() - t0

    if not image_paths:
        raise HTTPException(status_code=422, detail="No printable pages found in the PDF file.")

    # 3. Running PaddleOCR Extraction
    t0 = time.perf_counter()
    try:
        extracted_text = ocr_service.extract_text_from_images(image_paths)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"PaddleOCR extraction engine failed: {str(e)}")
    t_ocr = time.perf_counter() - t0

    # Cleanup temp images to free up space
    try:
        shutil.rmtree(page_images_dir)
    except Exception:
        pass  # non-blocking deletion failure

    if not extracted_text.strip():
        raise HTTPException(status_code=422, detail="OCR analysis failed to find any text on the pages.")

    # 4. Running AI Analysis
    t0 = time.perf_counter()
    try:
        extracted_receipt = llm_service.extract_structured_invoice(extracted_text, model_name=model)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI extraction model failed: {str(e)}")
    t_ai = time.perf_counter() - t0

    # 5. Map and save
    t0 = time.perf_counter()
    try:
        # Extract confidence details to save separately
        confidence_details = extracted_receipt.pop("confidence_details", None)
        
        # Store structured data locally
        data_path = os.path.join(DATA_DIR, f"{invoice_id}.json")
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(extracted_receipt, f, indent=4)
            
        # Store confidence data separately
        if confidence_details:
            conf_path = os.path.join(DATA_DIR, f"{invoice_id}_confidence.json")
            with open(conf_path, "w", encoding="utf-8") as f:
                json.dump(confidence_details, f, indent=4)
                
        # Re-attach for the immediate API response to UI
        if confidence_details:
            extracted_receipt["confidence_details"] = confidence_details
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save extracted invoice: {str(e)}")
    t_map_save = time.perf_counter() - t0
    t_total = time.perf_counter() - t_start

    print(f"--- [Scanned Pipeline Metrics for {file.filename}] ---", flush=True)
    print(f"  Step 1: Save Uploaded File      : {t_save:.3f}s", flush=True)
    print(f"  Step 2: Render PDF to Images   : {t_render:.3f}s", flush=True)
    print(f"  Step 3: PaddleOCR Text Extract  : {t_ocr:.3f}s", flush=True)
    print(f"  Step 4: Gemini LLM Extract     : {t_ai:.3f}s", flush=True)
    print(f"  Step 5: Map & Save Results     : {t_map_save:.3f}s", flush=True)
    print(f"  Total Elapsed Time             : {t_total:.3f}s", flush=True)

    return {"id": invoice_id, "data": extracted_receipt, "processing_time": t_total}




@router.post("/upload/handwritten")
async def upload_handwritten(file: UploadFile = File(...), model: str = Query(None)):
    """
    Pipeline 3: Handwritten PDF.
    PyMuPDF Render Pages -> Gemini Vision Extract (Multimodal) -> Map & Save -> Return ID + data.
    """
    print(f"--- [API] /upload/handwritten hit: {file.filename} ---", flush=True)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF documents are supported.")

    # Automatically clear any cached additional fields from previous invoices
    SchemaService.clear_custom_schema()

    t_start = time.perf_counter()
    invoice_id = generate_unique_id()
    pdf_path = os.path.join(UPLOAD_DIR, f"{invoice_id}.pdf")

    # 1. Save uploaded file
    t0 = time.perf_counter()
    try:
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    t_save = time.perf_counter() - t0

    # 2. Convert PDF pages to images
    t0 = time.perf_counter()
    try:
        page_images_dir = os.path.join(IMAGE_DIR, invoice_id)
        image_paths = PDFService.convert_to_images(pdf_path, page_images_dir)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render pages for AI: {str(e)}")
    t_render = time.perf_counter() - t0

    if not image_paths:
        raise HTTPException(status_code=422, detail="No printable pages found in the PDF file.")

    # 3. Running AI Analysis (Multimodal Vision)
    t0 = time.perf_counter()
    try:
        extracted_receipt = llm_service.extract_from_images(image_paths, model_name=model)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI multimodal extraction model failed: {str(e)}")
    t_ai = time.perf_counter() - t0

    # Cleanup temp images to free up space
    try:
        shutil.rmtree(page_images_dir)
    except Exception:
        pass  # non-blocking deletion failure

    # 4. Map and save
    t0 = time.perf_counter()
    try:
        # Extract confidence details to save separately
        confidence_details = extracted_receipt.pop("confidence_details", None)
        
        # Store structured data locally
        data_path = os.path.join(DATA_DIR, f"{invoice_id}.json")
        with open(data_path, "w", encoding="utf-8") as f:
            json.dump(extracted_receipt, f, indent=4)
            
        # Store confidence data separately
        if confidence_details:
            conf_path = os.path.join(DATA_DIR, f"{invoice_id}_confidence.json")
            with open(conf_path, "w", encoding="utf-8") as f:
                json.dump(confidence_details, f, indent=4)
                
        # Re-attach for the immediate API response to UI
        if confidence_details:
            extracted_receipt["confidence_details"] = confidence_details
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save extracted invoice: {str(e)}")
    t_map_save = time.perf_counter() - t0
    t_total = time.perf_counter() - t_start

    print(f"--- [Handwritten Pipeline Metrics for {file.filename}] ---", flush=True)
    print(f"  Step 1: Save Uploaded File      : {t_save:.3f}s", flush=True)
    print(f"  Step 2: Render PDF to Images   : {t_render:.3f}s", flush=True)
    print(f"  Step 3: Gemini Vision Extract  : {t_ai:.3f}s", flush=True)
    print(f"  Step 4: Map & Save Results     : {t_map_save:.3f}s", flush=True)
    print(f"  Total Elapsed Time             : {t_total:.3f}s", flush=True)

    return {"id": invoice_id, "data": extracted_receipt, "processing_time": t_total}

@router.get("/result/{invoice_id}")
async def get_result(invoice_id: str):
    """
    Fetches the saved structured invoice JSON matching the given invoice ID.
    """
    data_path = os.path.join(DATA_DIR, f"{invoice_id}.json")
    if not os.path.exists(data_path):
        raise HTTPException(status_code=404, detail="Requested invoice result not found.")

    try:
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        conf_path = os.path.join(DATA_DIR, f"{invoice_id}_confidence.json")
        if os.path.exists(conf_path):
            with open(conf_path, "r", encoding="utf-8") as f:
                data["confidence_details"] = json.load(f)
                
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load invoice result: {str(e)}")


@router.get("/pdf/{invoice_id}")
async def get_invoice_pdf(invoice_id: str):
    """
    Serves the raw uploaded PDF file matching the invoice ID for side-by-side frontend comparison.
    """
    pdf_path = os.path.join(UPLOAD_DIR, f"{invoice_id}.pdf")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found.")
    return FileResponse(pdf_path, media_type="application/pdf")


@router.get("/pdf/{invoice_id}/pages")
async def get_pdf_pages_info(invoice_id: str):
    """
    Returns a list of page URLs for rendering in the frontend.
    """
    pdf_path = os.path.join(UPLOAD_DIR, f"{invoice_id}.pdf")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found.")
    
    try:
        page_count = PDFService.get_page_count(pdf_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"pages": [f"/pdf/{invoice_id}/page/{i+1}" for i in range(page_count)]}


@router.get("/pdf/{invoice_id}/page/{page_num}")
async def get_pdf_page_image(invoice_id: str, page_num: int):
    """
    Serves the rendered page image, caching it inside the images_temp directory.
    """
    pdf_path = os.path.join(UPLOAD_DIR, f"{invoice_id}.pdf")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found.")
        
    img_path = os.path.join(IMAGE_DIR, invoice_id, f"page_{page_num}.jpg")
    
    if not os.path.exists(img_path):
        try:
            PDFService.render_page_to_image(pdf_path, page_num, img_path, zoom=2.0)
        except ValueError as ve:
            raise HTTPException(status_code=404, detail=str(ve))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to render page: {str(e)}")
            
    return FileResponse(img_path, media_type="image/jpeg")



@router.post("/export/json")
async def export_json(data: Dict[str, Any] = Body(...)):
    """
    Downloads custom edited invoice fields directly as a JSON file.
    """
    try:
        json_bytes = ExportService.generate_json_bytes(data)
        inv_id = _find_invoice_identifier(data)
        filename = f"invoice_{inv_id}.json"
        
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate JSON file: {str(e)}")


@router.post("/export/csv")
async def export_csv(data: Dict[str, Any] = Body(...)):
    """
    Flattens invoice items and downloads them as a CSV.
    """
    try:
        csv_bytes = ExportService.generate_csv_bytes(data)
        inv_id = _find_invoice_identifier(data)
        filename = f"invoice_items_{inv_id}.csv"
        
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate CSV file: {str(e)}")


@router.post("/export/excel")
async def export_excel(data: Dict[str, Any] = Body(...)):
    """
    Generates and downloads a professional Excel worksheet (xlsx) containing metadata and items.
    """
    try:
        xlsx_bytes = ExportService.generate_excel_bytes(data)
        inv_id = _find_invoice_identifier(data)
        filename = f"invoice_{inv_id}.xlsx"
        
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel file: {str(e)}")


@router.get("/schema/custom")
async def get_custom_schema():
    """
    Returns custom schema configuration.
    """
    return SchemaService.get_custom_schema()


@router.post("/schema/custom")
async def save_custom_schema(schema: Dict[str, Any] = Body(...)):
    """
    Saves custom schema configuration.
    """
    try:
        SchemaService.save_custom_schema(schema)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save custom schema: {str(e)}")

@router.post("/settings/model")
async def update_model_setting(model: str = Query(...)):
    """
    Updates the MODEL_NAME in the backend/.env file.
    """
    try:
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))
        if not os.path.exists(env_path):
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(f"MODEL_NAME={model}\n")
        else:
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            model_found = False
            with open(env_path, "w", encoding="utf-8") as f:
                for line in lines:
                    if line.startswith("MODEL_NAME="):
                        f.write(f"MODEL_NAME={model}\n")
                        model_found = True
                    else:
                        f.write(line)
                if not model_found:
                    f.write(f"MODEL_NAME={model}\n")
                    
        return {"status": "success", "model": model}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update .env file: {str(e)}")
