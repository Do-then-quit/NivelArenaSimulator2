import sys
import os

try:
    from pypdf import PdfReader
except ImportError:
    print("pypdf not found")
    sys.exit(1)

pdf_path = "NivelArena_Comprehensive_Rules_Ver.1.6.pdf"
if not os.path.exists(pdf_path):
    print(f"Error: {pdf_path} not found")
    sys.exit(1)

try:
    reader = PdfReader(pdf_path)
    text = ""
    for i, page in enumerate(reader.pages):
        text += f"--- Page {i+1} ---\n"
        text += page.extract_text() + "\n"

    with open("rules_text.txt", "w", encoding="utf-8") as f:
        f.write(text)

    print("Text extracted to rules_text.txt")

except Exception as e:
    print(f"Error reading PDF: {e}")
    sys.exit(1)
