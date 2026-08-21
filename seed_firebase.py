import json
import os
from utils_firebase import upload_to_firebase

files_to_upload = {
    'data.json': 'data',
    'data_hangblock.json': 'data_hangblock',
    'data_hopdong.json': 'data_hopdong',
    'data/bc01/manifest.json': 'bc01_manifest',
    'data/bc01/hangguic1_20260821.json': 'bc01_hangguic1_20260821'
}

for filename, node_name in files_to_upload.items():
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                print(f"Uploading {filename} to Firebase...")
                upload_to_firebase(node_name, data)
            except Exception as e:
                print(f"Error reading file {filename}: {e}")
    else:
        print(f"Skipping {filename}, file not found.")

print("Finished uploading initial data to Firebase!")
