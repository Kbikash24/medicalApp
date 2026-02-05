from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import base64
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection (with fallback to in-memory storage)
MEMORY_REPORTS = []
USE_MONGODB = False
client = None
db = None

try:
    mongo_url = os.environ.get('MONGO_URL')
    if mongo_url:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
        db = client[os.environ.get('DB_NAME', 'test_database')]
        # Test the connection
        USE_MONGODB = True
        logger.info("MongoDB client initialized")
    else:
        logger.warning("MONGO_URL not set, using in-memory storage")
except Exception as e:
    logger.warning(f"MongoDB initialization failed, using in-memory storage: {e}")
    USE_MONGODB = False

# Create the main app
app = FastAPI()

# Add CORS middleware BEFORE adding routes
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class ReportAnalysisRequest(BaseModel):
    image_base64: str
    language: str = "english"  # english or hindi

class HealthParameter(BaseModel):
    name: str
    value: str
    unit: str
    normal_range: str
    status: str  # normal, low, high, critical
    explanation: str
    hindi_explanation: Optional[str] = None

class AnalyzedReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    report_type: str  # blood_test, diagnostic, prescription
    title: str
    summary: str
    hindi_summary: Optional[str] = None
    parameters: List[HealthParameter]
    health_tips: List[str]
    hindi_health_tips: Optional[List[str]] = None
    overall_status: str  # good, moderate, concerning
    created_at: datetime = Field(default_factory=datetime.utcnow)
    image_base64: Optional[str] = None

class SavedReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    report_data: AnalyzedReport
    saved_at: datetime = Field(default_factory=datetime.utcnow)

class CompareReportsRequest(BaseModel):
    report_ids: List[str]

# Helper function to analyze medical report using GPT-4o
async def analyze_medical_report(image_base64: str, language: str = "english") -> dict:
    """Analyze a medical report image using OpenAI GPT-4o"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")
    
    system_message = """You are an expert medical report analyzer for Indian patients. 
Analyze medical reports (blood tests, X-rays, prescriptions, etc.) and provide clear, understandable explanations.

You MUST respond ONLY with valid JSON in this exact format:
{
    "report_type": "blood_test" or "diagnostic" or "prescription",
    "title": "Report title (e.g., Complete Blood Count Report)",
    "summary": "Brief summary of the report findings in simple English",
    "hindi_summary": "Hindi translation of the summary",
    "parameters": [
        {
            "name": "Parameter name (e.g., Hemoglobin)",
            "value": "Actual value from report",
            "unit": "Unit (e.g., g/dL)",
            "normal_range": "Normal range (e.g., 12-16 g/dL)",
            "status": "normal" or "low" or "high" or "critical",
            "explanation": "Simple explanation of what this means",
            "hindi_explanation": "Hindi translation of explanation"
        }
    ],
    "health_tips": ["Health tip 1", "Health tip 2", "Health tip 3"],
    "hindi_health_tips": ["Hindi tip 1", "Hindi tip 2", "Hindi tip 3"],
    "overall_status": "good" or "moderate" or "concerning"
}

IMPORTANT:
- Extract ALL parameters visible in the report
- Provide explanations in simple, easy-to-understand language
- Include Hindi translations for Indian users
- Give practical health tips based on the findings
- Be accurate with values and ranges
- If any value is abnormal, explain what it could mean and suggest consulting a doctor"""
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=system_message
        ).with_model("openai", "gpt-4.1-mini")
        
        # Create image content
        image_content = ImageContent(image_base64=image_base64)
        
        user_message = UserMessage(
            text=f"Please analyze this medical report and provide the analysis in JSON format. Language preference: {language}",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        logger.info(f"GPT-4o response received: {response[:500]}...")
        
        # Parse JSON response
        # Clean the response - remove markdown code blocks if present
        cleaned_response = response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.startswith("```"):
            cleaned_response = cleaned_response[3:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()
        
        result = json.loads(cleaned_response)
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {e}")
        logger.error(f"Response was: {response}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        logger.error(f"Error analyzing report: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing report: {str(e)}")

# Routes
@api_router.get("/")
async def root():
    return {
        "message": "Medical Report Scanner API", 
        "version": "1.0",
        "mongodb_connected": USE_MONGODB
    }

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "mongodb": "disconnected",
        "storage": "memory"
    }
    
    if USE_MONGODB and db is not None:
        try:
            # Test MongoDB connection
            await db.command("ping")
            health_status["mongodb"] = "connected"
            health_status["storage"] = "mongodb"
        except Exception as e:
            logger.error(f"MongoDB ping failed: {e}")
            health_status["mongodb"] = f"error: {str(e)}"
    
    return health_status

@api_router.post("/analyze-report", response_model=AnalyzedReport)
async def analyze_report(request: ReportAnalysisRequest):
    """Analyze a medical report image and return structured results"""
    try:
        # Validate base64 image
        if not request.image_base64:
            raise HTTPException(status_code=400, detail="No image provided")
        
        # Analyze the report
        analysis = await analyze_medical_report(request.image_base64, request.language)
        
        # Create AnalyzedReport object
        parameters = [
            HealthParameter(
                name=p.get("name", "Unknown"),
                value=p.get("value", "N/A"),
                unit=p.get("unit", ""),
                normal_range=p.get("normal_range", "N/A"),
                status=p.get("status", "normal"),
                explanation=p.get("explanation", ""),
                hindi_explanation=p.get("hindi_explanation")
            )
            for p in analysis.get("parameters", [])
        ]
        
        report = AnalyzedReport(
            report_type=analysis.get("report_type", "blood_test"),
            title=analysis.get("title", "Medical Report"),
            summary=analysis.get("summary", "Report analyzed successfully"),
            hindi_summary=analysis.get("hindi_summary"),
            parameters=parameters,
            health_tips=analysis.get("health_tips", []),
            hindi_health_tips=analysis.get("hindi_health_tips"),
            overall_status=analysis.get("overall_status", "moderate"),
            image_base64=request.image_base64[:100] + "..."  # Store truncated for reference
        )
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in analyze_report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/save-report", response_model=SavedReport)
async def save_report(report: AnalyzedReport):
    """Save an analyzed report to database"""
    try:
        saved_report = SavedReport(report_data=report)
        
        if USE_MONGODB and db is not None:
            try:
                report_dict = saved_report.model_dump()
                report_dict["saved_at"] = report_dict["saved_at"].isoformat()
                report_dict["report_data"]["created_at"] = report_dict["report_data"]["created_at"].isoformat()
                await db.reports.insert_one(report_dict)
                logger.info(f"Report saved to MongoDB: {saved_report.id}")
            except Exception as db_error:
                logger.error(f"MongoDB save failed, using memory: {db_error}")
                MEMORY_REPORTS.append(saved_report)
        else:
            MEMORY_REPORTS.append(saved_report)
            logger.info(f"Report saved to memory: {saved_report.id}")
        
        return saved_report
    except Exception as e:
        logger.error(f"Error saving report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reports", response_model=List[SavedReport])
async def get_reports():
    """Get all saved reports"""
    try:
        if USE_MONGODB and db is not None:
            try:
                reports = await db.reports.find().sort("saved_at", -1).to_list(100)
                result = []
                for r in reports:
                    r.pop("_id", None)
                    # Convert datetime strings back to datetime objects
                    if isinstance(r.get("saved_at"), str):
                        r["saved_at"] = datetime.fromisoformat(r["saved_at"])
                    if isinstance(r.get("report_data", {}).get("created_at"), str):
                        r["report_data"]["created_at"] = datetime.fromisoformat(r["report_data"]["created_at"])
                    result.append(SavedReport(**r))
                logger.info(f"Retrieved {len(result)} reports from MongoDB")
                return result
            except Exception as db_error:
                logger.error(f"MongoDB fetch failed, using memory: {db_error}")
                return sorted(MEMORY_REPORTS, key=lambda x: x.saved_at, reverse=True)
        else:
            logger.info(f"Retrieved {len(MEMORY_REPORTS)} reports from memory")
            return sorted(MEMORY_REPORTS, key=lambda x: x.saved_at, reverse=True)
    except Exception as e:
        logger.error(f"Error getting reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reports/{report_id}", response_model=SavedReport)
async def get_report(report_id: str):
    """Get a specific report by ID"""
    try:
        if USE_MONGODB:
            report = await db.reports.find_one({"id": report_id})
            if not report:
                raise HTTPException(status_code=404, detail="Report not found")
            report.pop("_id", None)
            if isinstance(report.get("saved_at"), str):
                report["saved_at"] = datetime.fromisoformat(report["saved_at"])
            if isinstance(report.get("report_data", {}).get("created_at"), str):
                report["report_data"]["created_at"] = datetime.fromisoformat(report["report_data"]["created_at"])
            return SavedReport(**report)
        else:
            for report in MEMORY_REPORTS:
                if report.id == report_id:
                    return report
            raise HTTPException(status_code=404, detail="Report not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/reports/{report_id}")
async def delete_report(report_id: str):
    """Delete a report by ID"""
    try:
        if USE_MONGODB:
            result = await db.reports.delete_one({"id": report_id})
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Report not found")
        else:
            for i, report in enumerate(MEMORY_REPORTS):
                if report.id == report_id:
                    MEMORY_REPORTS.pop(i)
                    return {"message": "Report deleted successfully"}
            raise HTTPException(status_code=404, detail="Report not found")
        return {"message": "Report deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/compare-reports")
async def compare_reports(request: CompareReportsRequest):
    """Compare multiple reports and show trends"""
    try:
        if len(request.report_ids) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 reports to compare")
        
        reports = []
        for report_id in request.report_ids:
            report = await db.reports.find_one({"id": report_id})
            if report:
                report.pop("_id", None)
                reports.append(report)
        
        if len(reports) < 2:
            raise HTTPException(status_code=404, detail="Not enough reports found")
        
        # Build comparison data
        comparison = {
            "reports": reports,
            "parameter_trends": {}
        }
        
        # Group parameters by name across reports
        all_params = {}
        for report in reports:
            report_date = report.get("saved_at", "Unknown")
            for param in report.get("report_data", {}).get("parameters", []):
                param_name = param.get("name")
                if param_name not in all_params:
                    all_params[param_name] = []
                all_params[param_name].append({
                    "date": report_date,
                    "value": param.get("value"),
                    "status": param.get("status")
                })
        
        comparison["parameter_trends"] = all_params
        return comparison
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    if USE_MONGODB:
        client.close()
