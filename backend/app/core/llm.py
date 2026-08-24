import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

def parse_symptoms(symptoms: str, severity: int) -> Dict[str, Any]:
    """
    Mock LLM function for Pre-visit summary.
    Required Prompt: "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>"
    """
    logger.info(f"[LLM PROMPT EXECUTED] Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: {symptoms}")
    
    urgency = "low"
    if severity >= 8:
        urgency = "high"
    elif severity >= 5:
        urgency = "medium"
        
    summary = f"**Chief Complaint:** {symptoms[:100]}...\n\n**Suggested Questions for Doctor:**\n1. What is the most likely cause of these symptoms?\n2. Are there any warning signs I should watch out for?\n3. How long should I expect recovery to take?"
    
    return {
        "llm_urgency_level": urgency,
        "llm_summary": summary
    }

def extract_prescriptions(notes: str) -> Dict[str, Any]:
    """
    Mock LLM function for Post-visit summary and prescription extraction.
    Required Prompt: "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>"
    """
    logger.info(f"[LLM PROMPT EXECUTED] Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: {notes}")
    
    summary = (
        "**Your Visit Summary:**\n\n"
        "Based on the doctor's consultation, here is a summary of your visit:\n\n"
        f"**Clinical Notes:**\n{notes}\n\n"
        "**Next Steps:**\n"
        "- Please ensure you follow the medication schedule below.\n"
        "- Rest well and stay hydrated.\n"
        "- Follow up in 7 days if symptoms persist or worsen."
    )
    
    prescriptions = []
    
    # Try to extract the exact prescription text from the raw notes
    import re
    match = re.search(r"Prescriptions:\s*(.+?)(?:\n|$)", notes, re.IGNORECASE)
    if match and match.group(1).strip():
        typed_rx = match.group(1).strip()
        prescriptions.append({
            "medication_name": typed_rx[:50] + ("..." if len(typed_rx)>50 else ""),
            "dosage": "As prescribed",
            "frequency": "Daily",
            "duration_days": 5,
            "instructions": "Follow doctor's advice",
            "reminder_enabled": True
        })
    elif "amoxicillin" in notes.lower():
        prescriptions.append({
            "medication_name": "Amoxicillin",
            "dosage": "500mg",
            "frequency": "Twice a day",
            "duration_days": 7,
            "instructions": "Take with food",
            "reminder_enabled": True
        })
    elif "paracetamol" in notes.lower() or "tylenol" in notes.lower():
         prescriptions.append({
            "medication_name": "Paracetamol",
            "dosage": "500mg",
            "frequency": "Every 6 hours as needed",
            "duration_days": 3,
            "instructions": "For fever/pain",
            "reminder_enabled": True
        })
    else:
        prescriptions.append({
            "medication_name": "General Care",
            "dosage": "N/A",
            "frequency": "As needed",
            "duration_days": 3,
            "instructions": "Rest and hydrate",
            "reminder_enabled": False
        })
        
    return {
        "llm_patient_summary": summary,
        "prescriptions": prescriptions
    }
