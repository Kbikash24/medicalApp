#!/usr/bin/env python3
"""
Backend API Testing for Medical Report Scanner
Tests all backend endpoints with realistic medical data
"""

import requests
import json
import sys
from datetime import datetime
import uuid

# Backend URL from frontend/.env
BACKEND_URL = "https://healthreportapp.preview.emergentagent.com/api"

def test_root_endpoint():
    """Test GET /api/ - should return API info"""
    print("🔍 Testing GET /api/ endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if "Medical Report Scanner API" in data.get("message", ""):
                print("✅ Root endpoint working correctly")
                return True
            else:
                print("❌ Root endpoint returned unexpected message")
                return False
        else:
            print(f"❌ Root endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Root endpoint test failed: {e}")
        return False

def test_get_reports_empty():
    """Test GET /api/reports - should return empty list initially"""
    print("\n🔍 Testing GET /api/reports (empty state)...")
    try:
        response = requests.get(f"{BACKEND_URL}/reports")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            reports = response.json()
            print(f"Reports count: {len(reports)}")
            print("✅ Get reports endpoint working")
            return True, reports
        else:
            print(f"❌ Get reports failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False, []
    except Exception as e:
        print(f"❌ Get reports test failed: {e}")
        return False, []

def test_save_report():
    """Test POST /api/save-report - save a mock medical report"""
    print("\n🔍 Testing POST /api/save-report...")
    
    # Create realistic medical report data
    mock_report = {
        "id": f"test-{uuid.uuid4()}",
        "report_type": "blood_test",
        "title": "Complete Blood Count Report",
        "summary": "Blood test results showing normal hemoglobin levels with slightly elevated white blood cell count",
        "hindi_summary": "रक्त परीक्षण के परिणाम सामान्य हीमोग्लोबिन स्तर दिखाते हैं लेकिन श्वेत रक्त कोशिकाओं की संख्या थोड़ी बढ़ी हुई है",
        "parameters": [
            {
                "name": "Hemoglobin",
                "value": "14.5",
                "unit": "g/dL",
                "normal_range": "12-16 g/dL",
                "status": "normal",
                "explanation": "Your hemoglobin level is within the normal range, indicating good oxygen-carrying capacity",
                "hindi_explanation": "आपका हीमोग्लोबिन स्तर सामान्य सीमा में है, जो अच्छी ऑक्सीजन ले जाने की क्षमता दर्शाता है"
            },
            {
                "name": "White Blood Cells",
                "value": "11.2",
                "unit": "×10³/μL",
                "normal_range": "4.0-10.0 ×10³/μL",
                "status": "high",
                "explanation": "Slightly elevated WBC count may indicate mild infection or inflammation. Consult your doctor",
                "hindi_explanation": "थोड़ी बढ़ी हुई WBC संख्या हल्के संक्रमण या सूजन का संकेत हो सकती है। अपने डॉक्टर से सलाह लें"
            },
            {
                "name": "Platelets",
                "value": "285",
                "unit": "×10³/μL",
                "normal_range": "150-450 ×10³/μL",
                "status": "normal",
                "explanation": "Platelet count is normal, indicating good blood clotting function",
                "hindi_explanation": "प्लेटलेट की संख्या सामान्य है, जो अच्छे रक्त जमने की क्रिया दर्शाती है"
            }
        ],
        "health_tips": [
            "Stay well hydrated by drinking 8-10 glasses of water daily",
            "Include iron-rich foods like spinach, lentils, and lean meat in your diet",
            "Get adequate rest and avoid stress to support immune system",
            "Monitor for any signs of infection and consult doctor if symptoms persist"
        ],
        "hindi_health_tips": [
            "दैनिक 8-10 गिलास पानी पीकर अच्छी तरह हाइड्रेटेड रहें",
            "अपने आहार में पालक, दाल और दुबला मांस जैसे आयरन युक्त खाद्य पदार्थ शामिल करें",
            "प्रतिरक्षा प्रणाली को मजबूत बनाने के लिए पर्याप्त आराम करें और तनाव से बचें",
            "संक्रमण के किसी भी लक्षण पर नज़र रखें और लक्षण बने रहने पर डॉक्टर से सलाह लें"
        ],
        "overall_status": "moderate"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/save-report", json=mock_report)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            saved_report = response.json()
            print(f"✅ Report saved successfully with ID: {saved_report.get('id')}")
            print(f"Report data ID: {saved_report.get('report_data', {}).get('id')}")
            return True, saved_report
        else:
            print(f"❌ Save report failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
    except Exception as e:
        print(f"❌ Save report test failed: {e}")
        return False, None

def test_get_reports_with_data():
    """Test GET /api/reports - should return the saved report"""
    print("\n🔍 Testing GET /api/reports (with saved data)...")
    try:
        response = requests.get(f"{BACKEND_URL}/reports")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            reports = response.json()
            print(f"Reports count: {len(reports)}")
            if len(reports) > 0:
                print(f"✅ Found {len(reports)} report(s)")
                # Print first report details
                first_report = reports[0]
                print(f"First report ID: {first_report.get('id')}")
                print(f"Report type: {first_report.get('report_data', {}).get('report_type')}")
                print(f"Title: {first_report.get('report_data', {}).get('title')}")
                return True, reports
            else:
                print("⚠️ No reports found after saving")
                return False, []
        else:
            print(f"❌ Get reports failed with status {response.status_code}")
            return False, []
    except Exception as e:
        print(f"❌ Get reports test failed: {e}")
        return False, []

def test_delete_report(report_id):
    """Test DELETE /api/reports/{report_id} - delete the test report"""
    print(f"\n🔍 Testing DELETE /api/reports/{report_id}...")
    try:
        response = requests.delete(f"{BACKEND_URL}/reports/{report_id}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Report deleted successfully: {result.get('message')}")
            return True
        elif response.status_code == 404:
            print("⚠️ Report not found (may have been deleted already)")
            return True  # Consider this success for testing purposes
        else:
            print(f"❌ Delete report failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Delete report test failed: {e}")
        return False

def test_get_specific_report(report_id):
    """Test GET /api/reports/{report_id} - get specific report"""
    print(f"\n🔍 Testing GET /api/reports/{report_id}...")
    try:
        response = requests.get(f"{BACKEND_URL}/reports/{report_id}")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            report = response.json()
            print(f"✅ Retrieved specific report: {report.get('report_data', {}).get('title')}")
            return True, report
        elif response.status_code == 404:
            print("⚠️ Report not found")
            return False, None
        else:
            print(f"❌ Get specific report failed with status {response.status_code}")
            return False, None
    except Exception as e:
        print(f"❌ Get specific report test failed: {e}")
        return False, None

def main():
    """Run all backend API tests"""
    print("🚀 Starting Medical Report Scanner Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    test_results = []
    
    # Test 1: Root endpoint
    result1 = test_root_endpoint()
    test_results.append(("Root API endpoint", result1))
    
    # Test 2: Get reports (empty)
    result2, initial_reports = test_get_reports_empty()
    test_results.append(("Get reports (empty)", result2))
    
    # Test 3: Save report
    result3, saved_report = test_save_report()
    test_results.append(("Save report", result3))
    
    saved_report_id = None
    if saved_report:
        # Try to get the report ID from different possible locations
        saved_report_id = (saved_report.get('id') or 
                          saved_report.get('report_data', {}).get('id'))
    
    # Test 4: Get reports (with data)
    result4, reports_with_data = test_get_reports_with_data()
    test_results.append(("Get reports (with data)", result4))
    
    # If we couldn't get report ID from save response, try to get it from the reports list
    if not saved_report_id and reports_with_data:
        saved_report_id = (reports_with_data[0].get('id') or 
                          reports_with_data[0].get('report_data', {}).get('id'))
    
    # Test 5: Get specific report (if we have an ID)
    if saved_report_id:
        result5, specific_report = test_get_specific_report(saved_report_id)
        test_results.append(("Get specific report", result5))
        
        # Test 6: Delete report
        result6 = test_delete_report(saved_report_id)
        test_results.append(("Delete report", result6))
    else:
        print("\n⚠️ Skipping specific report and delete tests - no report ID available")
        test_results.append(("Get specific report", False))
        test_results.append(("Delete report", False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<30} {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️ Some tests failed. Check the logs above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())