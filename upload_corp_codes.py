import os
import requests
import zipfile
import io
import xml.etree.ElementTree as ET
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()
dart_api_key = os.getenv("DART_API_KEY")
supabase_api_key = os.getenv("SUPABASE_API_KEY")
supabase_url = "https://wdgrexbgxqactpaeugfm.supabase.co/rest/v1/corp_codes"

if not dart_api_key or not supabase_api_key:
    print("Error: DART_API_KEY or SUPABASE_API_KEY not found in .env file.")
    exit(1)

# 1. DART 고유번호 다운로드 및 XML 파싱
print("Downloading corp_codes from DART...")
url = "https://opendart.fss.or.kr/api/corpCode.xml"
params = {"crtfc_key": dart_api_key}

response = requests.get(url, params=params)
if response.status_code != 200:
    print(f"Error: Failed to download data (Status: {response.status_code})")
    exit(1)

try:
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        xml_filename = z.namelist()[0]
        with z.open(xml_filename) as f:
            xml_data = f.read()
except zipfile.BadZipFile:
    print("Error: Response is not a valid ZIP file. Please check your DART API key.")
    exit(1)

print("Parsing XML data and cleaning values...")
root = ET.fromstring(xml_data)
all_data = []

for list_node in root.findall('list'):
    corp_code = list_node.findtext('corp_code')
    corp_name = list_node.findtext('corp_name')
    corp_eng_name = list_node.findtext('corp_eng_name')
    stock_code = list_node.findtext('stock_code')
    modify_date = list_node.findtext('modify_date')

    # 빈 문자열 또는 None인 경우 null(None)로 처리
    all_data.append({
        'corp_code': corp_code,
        'corp_name': corp_name,
        'corp_eng_name': corp_eng_name if corp_eng_name and corp_eng_name.strip() else None,
        'stock_code': stock_code if stock_code and stock_code.strip() else None,
        'modify_date': modify_date
    })

# 2. Supabase 업로드 (1000개씩 분절)
headers = {
    "apikey": supabase_api_key,
    "Authorization": f"Bearer {supabase_api_key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

batch_size = 1000
total_count = len(all_data)
print(f"Total {total_count} records to upload. Starting batch upload...")

for i in range(0, total_count, batch_size):
    batch = all_data[i:i + batch_size]
    
    # Supabase REST API (PostgREST)를 통한 Bulk Insert
    res = requests.post(supabase_url, headers=headers, json=batch)
    
    if res.status_code in [200, 201]:
        print(f"Uploaded: {i + len(batch)} / {total_count}")
    else:
        print(f"Error at batch {i}: {res.status_code}")
        print(f"Response: {res.text}")
        # 오류 발생 시 중단하거나 기록
        break

print("Upload process finished.")
