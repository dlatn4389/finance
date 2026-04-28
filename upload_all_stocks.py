import os
import requests
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()
krx_api_key = os.getenv("KRX_API_KEY")
supabase_api_key = os.getenv("SUPABASE_API_KEY")
supabase_url = "https://wdgrexbgxqactpaeugfm.supabase.co/rest/v1/listed_stocks"

if not krx_api_key or not supabase_api_key:
    print("Error: KRX_API_KEY or SUPABASE_API_KEY not found in .env file.")
    exit(1)

# 각 시장별 API 엔드포인트
endpoints = {
    "KOSPI": "https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info",
    "KOSDAQ": "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info",
    "KONEX": "https://data-dbg.krx.co.kr/svc/apis/sto/knx_isu_base_info"
}

headers = {
    "AUTH_KEY": krx_api_key
}

supabase_headers = {
    "apikey": supabase_api_key,
    "Authorization": f"Bearer {supabase_api_key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

all_items = []

# 1. KRX 데이터 수집
for market, url in endpoints.items():
    base_date = datetime.now().strftime("%Y%m%d")
    print(f"Fetching {market} stocks via KRX API (Base Date: {base_date})...")
    
    params = {"basDd": base_date}
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code != 200:
        print(f"Error for {market}: HTTP {response.status_code}")
        continue
        
    try:
        res_data = response.json()
        items = res_data.get("OutBlock_1", [])
        
        if not items:
            print(f"No data found for {base_date}. Searching latest available date for {market}...")
            for i in range(1, 8):
                prev_date = (datetime.now() - timedelta(days=i)).strftime("%Y%m%d")
                params["basDd"] = prev_date
                response = requests.get(url, headers=headers, params=params)
                res_data = response.json()
                items = res_data.get("OutBlock_1", [])
                if items:
                    print(f"Found {market} data for {prev_date}.")
                    break
                    
        if items:
            # 컬럼명 소문자 변환 및 null 처리 (필요시)
            for item in items:
                # Supabase 테이블 컬럼명이 소문자인 경우를 대비해 변환하거나 그대로 사용
                # 여기서는 API 응답 키(대문자)를 그대로 사용한다고 가정합니다. 
                # 만약 DB 컬럼이 소문자라면 [k.lower(): v for k, v in item.items()] 로 변환 필요
                all_items.append(item)
    except Exception as e:
        print(f"Error parsing response for {market}: {e}")

# 2. Supabase 업로드 (1000개씩 분절)
if all_items:
    batch_size = 1000
    total_count = len(all_items)
    print(f"Total {total_count} records to upload. Starting batch upload to Supabase...")
    
    for i in range(0, total_count, batch_size):
        batch = all_items[i:i + batch_size]
        res = requests.post(supabase_url, headers=supabase_headers, json=batch)
        
        if res.status_code in [200, 201]:
            print(f"Uploaded: {min(i + batch_size, total_count)} / {total_count}")
        else:
            print(f"Error at batch {i}: {res.status_code}")
            print(f"Response: {res.text}")
            break
    print("Upload process finished.")
else:
    print("No data collected from KRX.")
