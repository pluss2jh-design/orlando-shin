import sys
import zipfile
import xml.etree.ElementTree as ET

def extract(path):
    try:
        document = zipfile.ZipFile(path)
        xml_content = document.read('word/document.xml')
        document.close()
        tree = ET.XML(xml_content)
        ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        paras = []
        for p in tree.iter('{%s}p' % ns):
            texts = [node.text for node in p.iter('{%s}t' % ns) if node.text]
            if texts:
                paras.append("".join(texts))
        with open('temp_docx_utf8.txt', 'w', encoding='utf-8') as f:
            f.write("\n".join(paras))
    except Exception as e:
        print(f"Error: {e}")

extract('c:/Users/user/Desktop/개발/orlando-shin/텐배거 발굴 분석 절차 정리.docx')
