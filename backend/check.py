
import urllib.request, json
from app.core.security import create_access_token
token = create_access_token(user_id='a37ac244-b730-477d-bbe1-0c2fed73bc2c', role='patient')
req = urllib.request.Request('http://localhost:8000/api/v1/patient/appointments')
req.add_header('Cookie', 'access_token=' + token)
data = json.loads(urllib.request.urlopen(req).read().decode())
print(f'Total Appointments: {len(data)}')
found_completed = False
for a in data:
    if a['status'] == 'completed':
        print('COMPLETED ID:', a['id'])
        print('Has Visit Note:', bool(a.get('visit_note')))
        if a.get('visit_note'):
            print('  Summary:', repr(a['visit_note'].get('llm_patient_summary'))[:50])
            print('  Prescriptions:', len(a['visit_note'].get('prescriptions', [])))
        found_completed = True
        break
if not found_completed:
    print('NO COMPLETED APPOINTMENTS FOUND!')

