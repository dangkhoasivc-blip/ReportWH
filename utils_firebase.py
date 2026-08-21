import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
import os

_firebase_app = None

def get_firebase_app():
    global _firebase_app
    if _firebase_app is None:
        try:
            # Look for the json key in the current directory
            key_file = 'bc-kho-firebase-adminsdk-fbsvc-5bdaed2a3f.json'
            if not os.path.exists(key_file):
                print(f"Error: Could not find key file {key_file} to connect to Firebase.")
                return None
                
            cred = credentials.Certificate(key_file)
            _firebase_app = firebase_admin.initialize_app(cred, {
                'databaseURL': 'https://bc-kho-default-rtdb.asia-southeast1.firebasedatabase.app/'
            })
        except Exception as e:
            print(f"Firebase init error: {e}")
    return _firebase_app

def upload_to_firebase(node_name, data):
    """
    Upload data to Firebase Realtime Database.
    node_name: e.g. 'data_hangblock'
    data: json list/dict
    """
    app = get_firebase_app()
    if app is None:
        return False
        
    try:
        ref = db.reference(node_name)
        ref.set(data)
        print(f"Successfully uploaded data to Firebase (node: {node_name})")
        return True
    except Exception as e:
        print(f"Error uploading to Firebase: {e}")
        return False
