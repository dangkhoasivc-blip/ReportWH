import re
import os

scripts = {
    'export_to_json.py': ('data', 'payload'),
    'export_hangblock.py': ('data_hangblock', 'payload'),
    'export_hopdong.py': ('data_hopdong', 'payload'),
}

patch_code = """
    # Upload to Firebase
    try:
        from utils_firebase import upload_to_firebase
        print("\\nUploading to Firebase...")
        upload_to_firebase('{node}', {payload_var})
    except ImportError:
        print("\\n(Firebase utility not found, skipping upload)")
"""

for script_file, (node, payload_var) in scripts.items():
    if not os.path.exists(script_file): continue
    with open(script_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "upload_to_firebase" in content:
        continue

    # find where json.dump is
    pattern = r'(json\.dump\([\w\s=,\.\(\)":]+\)\n\s*size_kb = [^\n]+\n)'
    
    def repl(m):
        return m.group(1) + patch_code.format(node=node, payload_var=payload_var)

    new_content = re.sub(pattern, repl, content)
    with open(script_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Patched {script_file}")

# For export_hangguic1.py
if os.path.exists('export_hangguic1.py'):
    with open('export_hangguic1.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "upload_to_firebase" not in content:
        # Patch manifest dump
        manifest_pattern = r'(json\.dump\(manifest_data, f, ensure_ascii=False, indent=2\)\n)'
        manifest_patch = """
    try:
        from utils_firebase import upload_to_firebase
        upload_to_firebase('bc01_manifest', manifest_data)
    except Exception as e:
        pass
"""
        content = re.sub(manifest_pattern, r'\1' + manifest_patch, content)

        # Patch date file dump
        date_pattern = r'(json\.dump\(payload, f, ensure_ascii=False, separators=\(",", ":"\)\)\n)'
        date_patch = """
            try:
                from utils_firebase import upload_to_firebase
                node_name = out_filename.replace('.json', '')
                upload_to_firebase('bc01_' + node_name, payload)
            except Exception as e:
                pass
"""
        content = re.sub(date_pattern, r'\1' + date_patch, content)
        
        with open('export_hangguic1.py', 'w', encoding='utf-8') as f:
            f.write(content)
        print("Patched export_hangguic1.py")
