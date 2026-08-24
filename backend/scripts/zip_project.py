import os
import zipfile
import pathspec

def get_ignored_paths(root_dir):
    gitignore_path = os.path.join(root_dir, '.gitignore')
    if not os.path.exists(gitignore_path):
        return None
    with open(gitignore_path, 'r') as f:
        spec = pathspec.PathSpec.from_lines(pathspec.patterns.GitWildMatchPattern, f)
    return spec

def zip_project(output_filename):
    root_dir = os.path.abspath(os.getcwd())
    spec = get_ignored_paths(root_dir)
    
    # Standard exclusions even if not in gitignore
    always_exclude = ['.git', '__pycache__', '.env', 'node_modules', '.venv', 'dist']

    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            # Exclude directories
            dirs[:] = [d for d in dirs if d not in always_exclude]
            
            for file in files:
                if file in always_exclude or file.endswith('.zip'):
                    continue
                
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, root_dir)
                
                # Check gitignore
                if spec and spec.match_file(rel_path):
                    continue
                
                zipf.write(file_path, rel_path)
    
    print(f"Successfully created {output_filename}")

if __name__ == "__main__":
    zip_project('HealthcareManager_Clean.zip')
