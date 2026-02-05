#!/usr/bin/env python3
"""
Test the analyze-report endpoint with a sample medical report image
"""

import requests
import base64
import json

# Backend URL
BACKEND_URL = "https://healthreportapp.preview.emergentagent.com/api"

def create_sample_medical_report_image():
    """Create a simple base64 encoded image for testing"""
    # This is a minimal 1x1 PNG image in base64 - just for testing the endpoint
    # In real usage, this would be an actual medical report image
    minimal_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    return minimal_png

def test_analyze_report_endpoint():
    """Test POST /api/analyze-report endpoint"""
    print("🔍 Testing POST /api/analyze-report endpoint...")
    
    # Create test request
    test_request = {
        "image_base64": create_sample_medical_report_image(),
        "language": "english"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/analyze-report", json=test_request)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Analyze report endpoint working")
            print(f"Report Type: {result.get('report_type')}")
            print(f"Title: {result.get('title')}")
            print(f"Summary: {result.get('summary')[:100]}...")
            print(f"Parameters count: {len(result.get('parameters', []))}")
            return True
        else:
            print(f"❌ Analyze report failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Analyze report test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Testing Medical Report Analysis Endpoint")
    print("=" * 50)
    
    result = test_analyze_report_endpoint()
    
    print("\n" + "=" * 50)
    if result:
        print("🎉 Analysis endpoint test passed!")
    else:
        print("⚠️ Analysis endpoint test failed!")