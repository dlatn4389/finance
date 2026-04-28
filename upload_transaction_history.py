import os
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

# 1. 환경 변수 로드
load_dotenv()
dart_api_key = os.getenv("DART_API_KEY")
supabase_api_key = os.getenv("SUPABASE_API_KEY")
supabase_base_url = "https://wdgrexbgxqactpaeugfm.supabase.co/rest/v1"

# 필수 API 키 확인
if not dart_api_key or not supabase_api_key:
    print("❌ 오류: .env 파일에 DART_API_KEY 또는 SUPABASE_API_KEY가 설정되어 있지 않습니다.")
    exit(1)

# Supabase 요청 헤더 설정
supabase_headers = {
    "apikey": supabase_api_key,
    "Authorization": f"Bearer {supabase_api_key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def fetch_listed_corp_codes():
    """
    1. listed_stocks 테이블에서 모든 상장종목 코드를 불러오고,
    2. corp_codes 테이블에서 해당 종목들의 DART 고유번호(corp_code)를 가져와 매핑을 생성합니다.
    (Supabase의 1000개 제한을 회피하기 위해 페이지네이션을 사용합니다.)
    """
    print("🔍 [Step 1] Supabase에서 상장종목 리스트를 불러오는 중...")
    
    listed_stock_codes = set()
    limit = 1000
    offset = 0
    
    while True:
        list_url = f"{supabase_base_url}/listed_stocks?select=ISU_SRT_CD&limit={limit}&offset={offset}"
        res = requests.get(list_url, headers=supabase_headers)
        
        if res.status_code != 200:
            print(f"❌ 상장종목 리스트 조회 실패: {res.status_code} {res.text}")
            break
            
        data = res.json()
        if not data:
            break
            
        for item in data:
            if item.get("ISU_SRT_CD"):
                listed_stock_codes.add(item.get("ISU_SRT_CD"))
        
        if len(data) < limit:
            break
        offset += limit
        
    print(f"✅ 총 {len(listed_stock_codes)}개의 상장종목 코드를 확보했습니다.")

    # corp_codes 테이블에서 매칭되는 corp_code(고유번호) 가져오기
    print("🔍 [Step 2] 상장종목과 매칭되는 DART 고유번호(corp_code)를 검색 중...")
    
    corp_to_stock = {}
    offset = 0
    
    while True:
        mapping_url = f"{supabase_base_url}/corp_codes?select=corp_code,stock_code&stock_code=not.is.null&limit={limit}&offset={offset}"
        res = requests.get(mapping_url, headers=supabase_headers)
        
        if res.status_code != 200:
            print(f"❌ 고유번호 매핑 조회 실패: {res.status_code}")
            break
            
        data = res.json()
        if not data:
            break
            
        # {corp_code: stock_code} 매핑 추가 (상장종목 리스트에 존재하는 것만)
        for item in data:
            s_code = item.get("stock_code")
            c_code = item.get("corp_code")
            if s_code in listed_stock_codes:
                corp_to_stock[c_code] = s_code
                
        if len(data) < limit:
            break
        offset += limit
    
    print(f"✅ 상장종목 중 DART 고유번호가 확인된 {len(corp_to_stock)}개 기업을 대상으로 선정했습니다.")
    return corp_to_stock

def upload_to_supabase(data_list):
    """
    수집된 데이터를 transaction_history 테이블에 업로드합니다.
    """
    if not data_list:
        return
        
    target_url = f"{supabase_base_url}/transaction_history"
    batch_size = 1000
    
    for i in range(0, len(data_list), batch_size):
        batch = data_list[i:i + batch_size]
        try:
            res = requests.post(target_url, headers=supabase_headers, json=batch)
            if res.status_code not in [200, 201]:
                print(f"❌ Supabase 업로드 실패: {res.status_code} {res.text}")
                exit(1)
            print(f"   📥 {min(i + batch_size, len(data_list))}개 레코드 업로드 완료")
        except requests.exceptions.RequestException as e:
            print(f"❌ Supabase 업로드 중 네트워크 오류 발생: {e}")
            exit(1)

def main():
    # 1. 대상 기업 매핑 확보 {corp_code: stock_code}
    corp_stock_map = fetch_listed_corp_codes()
    if not corp_stock_map:
        print("❌ 실행할 대상이 없습니다.")
        return

    target_corp_codes = list(corp_stock_map.keys())

    # 2. 기업별 DART API 호출 및 처리
    print(f"🚀 [Step 3] {len(target_corp_codes)}개 기업의 공시 데이터 수집을 시작합니다.")
    
    # 숫자 필드 변환을 위한 목록
    numeric_fields = [
        "sp_stock_lmp_cnt", "sp_stock_lmp_irds_cnt", 
        "sp_stock_lmp_rate", "sp_stock_lmp_irds_rate"
    ]

    total_uploaded_count = 0
    start_time = time.time()

    for idx, corp_code in enumerate(target_corp_codes):
        # DART API 호출 (임원 및 주요주주 소유보고)
        dart_url = "https://opendart.fss.or.kr/api/elestock.json"
        params = {"crtfc_key": dart_api_key, "corp_code": corp_code}
        
        # 현재 corp_code에 해당하는 stock_code 가져오기
        current_stock_code = corp_stock_map.get(corp_code)
        
        # 진행 상황 출력
        if (idx + 1) % 10 == 0 or idx == 0:
            elapsed = time.time() - start_time
            print(f"📊 진행 중: ({idx + 1}/{len(target_corp_codes)}) - 경과 시간: {elapsed:.1f}초")

        try:
            response = requests.get(dart_url, params=params)
            
            if response.status_code != 200:
                print(f"   ⚠️ {corp_code} API 호출 실패 (HTTP {response.status_code})")
                continue

            res_json = response.json()
            # DART 에러 코드 확인 (000: 정상)
            if res_json.get("status") != "000":
                if res_json.get("status") != "013":
                    print(f"   ℹ️ {corp_code}: {res_json.get('message')} ({res_json.get('status')})")
                continue

            records = res_json.get("list", [])
            filtered_data = []

            for item in records:
                # [필터링] 2025년 1월 1일 이후 접수된 공시만 대상
                rcept_dt_raw = item.get("rcept_dt", "").replace("-", "").replace(".", "")
                if rcept_dt_raw >= "20250101":
                    
                    # [전처리] rcept_dt를 date 타입(YYYY-MM-DD)으로 변환
                    if len(rcept_dt_raw) == 8:
                        item["rcept_dt"] = f"{rcept_dt_raw[:4]}-{rcept_dt_raw[4:6]}-{rcept_dt_raw[6:]}"
                    
                    # [전처리] 숫자 데이터 콤마 제거 및 타입 변환
                    for field in numeric_fields:
                        val = item.get(field)
                        if val and isinstance(val, str):
                            val_clean = val.replace(",", "")
                            try:
                                if "." in val_clean:
                                    item[field] = float(val_clean)
                                else:
                                    item[field] = int(val_clean)
                            except ValueError:
                                item[field] = None
                    
                    # [전처리] stock_code 강제 할당 (Supabase Not-null 제약 조건 준수)
                    item["stock_code"] = current_stock_code
                    
                    filtered_data.append(item)

            if filtered_data:
                upload_to_supabase(filtered_data)
                total_uploaded_count += len(filtered_data)

        except Exception as e:
            print(f"   ❌ {corp_code} 처리 중 예외 발생: {e}")
            continue

    print(f"\n✨ 모든 작업이 완료되었습니다!")
    print(f"✅ 총 수집/업로드된 공시 레코드 수: {total_uploaded_count}")
    print(f"⏰ 총 소요 시간: {time.time() - start_time:.1f}초")

if __name__ == "__main__":
    main()
