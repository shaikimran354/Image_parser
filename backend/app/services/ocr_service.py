import os
from typing import List
from paddleocr import PaddleOCR

class OCRService:
    def __init__(self):
        # Initialize PaddleOCR engine as requested by prompt with use_angle_cls=True
        # Lang set to English. Enable MKLDNN for speed if on CPU
        self.ocr_engine = PaddleOCR(
            use_angle_cls=True, 
            lang='en',
            show_log=False
        )

    def extract_text_from_images(self, image_paths: List[str], y_tolerance: int = 15) -> str:
        """
        Runs PaddleOCR on each image in image_paths and reconstructs lines of text
        by clustering bounding boxes that are horizontally aligned.
        """
        full_text = ""
        
        for img_path in image_paths:
            if not os.path.exists(img_path):
                continue
                
            # Perform OCR on single image
            # result is a list of lists containing: [ [ [x1, y1], [x2, y2], [x3, y3], [x4, y4] ], (text_content, confidence) ]
            result = self.ocr_engine.ocr(img_path, cls=True)
            
            if not result or not result[0]:
                continue
                
            for page_result in result:
                if not page_result:
                    continue
                    
                # Sort blocks vertically by top-left y coordinate
                page_result.sort(key=lambda b: b[0][0][1])
                
                lines = []
                current_line = []
                last_y = None
                
                for block in page_result:
                    box = block[0]
                    text = block[1][0]
                    x = box[0][0]
                    y = box[0][1]
                    
                    if last_y is None:
                        current_line.append((x, text))
                        last_y = y
                    elif abs(y - last_y) <= y_tolerance:
                        current_line.append((x, text))
                    else:
                        # Process the completed line: sort horizontally by x coordinate
                        current_line.sort(key=lambda item: item[0])
                        # Join elements in line using tabs to preserve spacing/columns
                        lines.append(" \t ".join([item[1] for item in current_line]))
                        current_line = [(x, text)]
                        last_y = y
                        
                # Add the last remaining line
                if current_line:
                    current_line.sort(key=lambda item: item[0])
                    lines.append(" \t ".join([item[1] for item in current_line]))
                    
                full_text += "\n".join(lines) + "\n\n"
                
        return full_text
