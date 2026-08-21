import firebase_admin
from firebase_admin import credentials
from firebase_admin import db

try:
    cred = credentials.Certificate('bc-kho-firebase-adminsdk-fbsvc-5bdaed2a3f.json')
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://bc-kho-default-rtdb.firebaseio.com/'
    })
    ref = db.reference('test')
    ref.set({'status': 'ok'})
    print('Success with default URL!')
except Exception as e:
    print(f"Error: {e}")
    try:
        firebase_admin.delete_app(firebase_admin.get_app())
        firebase_admin.initialize_app(cred, {
            'databaseURL': 'https://bc-kho-default-rtdb.asia-southeast1.firebasedatabase.app/'
        })
        ref = db.reference('test')
        ref.set({'status': 'ok'})
        print('Success with asia-southeast1 URL!')
    except Exception as e2:
        print(f"Error 2: {e2}")
