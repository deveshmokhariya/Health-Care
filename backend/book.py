
import urllib.request, json, uuid
req = urllib.request.Request('http://localhost:8000/api/v1/auth/login', data=b'username=shlok%40gmail.com&password=password', headers={'Content-Type':'application/x-www-form-urlencoded'})
token = json.loads(urllib.request.urlopen(req).read())['access_token']
headers = {'Cookie': 'access_token=' + token, 'Content-Type': 'application/json'}

# 1. Get doctors
req = urllib.request.Request('http://localhost:8000/api/v1/patient/doctors', headers=headers)
doc_id = json.loads(urllib.request.urlopen(req).read())[0]['id']

# 2. Get slots for tomorrow
req = urllib.request.Request(f'http://localhost:8000/api/v1/patient/doctors/{doc_id}/slots?target_date=2026-08-25', headers=headers)
slots = json.loads(urllib.request.urlopen(req).read())[0]['available_slots']
slot_start = slots[0]['slot_start']
print('Slot:', slot_start)

# 3. Hold slot
req = urllib.request.Request('http://localhost:8000/api/v1/patient/appointments/hold', data=json.dumps({'doctor_id': doc_id, 'slot_start': slot_start}).encode(), headers=headers)
appt_id = json.loads(urllib.request.urlopen(req).read())['appointment_id']
print('Held appt:', appt_id)

# 4. Confirm slot
req = urllib.request.Request(f'http://localhost:8000/api/v1/patient/appointments/{appt_id}/confirm', data=json.dumps({'symptoms': 'Headache', 'duration_days': 2, 'severity': 5}).encode(), headers=headers)
conf = json.loads(urllib.request.urlopen(req).read())
print('Confirmed appt status:', conf['status'])

# 5. Fetch appointments
req = urllib.request.Request('http://localhost:8000/api/v1/patient/appointments', headers=headers)
appts = json.loads(urllib.request.urlopen(req).read())
for a in appts[:3]:
    print('Patient sees:', a['id'], a['status'])

