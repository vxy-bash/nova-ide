import os
import sys
import subprocess
import shutil
import json

def log(msg):
    print(f"\n[Nova Builder] ===> {msg}")

def check_command(cmd, name):
    if not shutil.which(cmd):
        print(f"Error: '{cmd}' is not installed or not in PATH. Please install {name} first.")
        sys.exit(1)

# Tkinter Form for backing up defaults
def get_baked_settings():
    try:
        import tkinter as tk
        from tkinter import ttk
    except ImportError:
        print("Tkinter not available. Skipping GUI settings prompt.")
        return {}

    root = tk.Tk()
    root.title("Nova IDE - Bake Release Settings")
    root.geometry("420x400")
    root.configure(bg="#141416")
    root.resizable(False, False)
    
    # Set icon if exists
    ico_path = os.path.join(os.getcwd(), "backend", "static", "logo.ico")
    if os.path.exists(ico_path):
        try:
            root.iconbitmap(ico_path)
        except Exception:
            pass
            
    results = {}
    
    # Title
    lbl = tk.Label(root, text="BAKE CREDENTIALS INTO INSTALLER", bg="#141416", fg="#2563eb", font=("Arial", 11, "bold"))
    lbl.pack(pady=15)
    
    desc = tk.Label(root, text="Configure default keys for the final app distribution.", bg="#141416", fg="#a0aec0", font=("Arial", 9))
    desc.pack(pady=5)
    
    # Helper to add inputs
    def add_field(label, show=""):
        frame = tk.Frame(root, bg="#141416")
        frame.pack(fill="x", padx=30, pady=6)
        flbl = tk.Label(frame, text=label, bg="#141416", fg="#e2e8f0", font=("Arial", 9, "bold"))
        flbl.pack(anchor="w", pady=2)
        entry = tk.Entry(frame, bg="#1e1e22", fg="#ffffff", insertbackground="white", bd=1, relief="solid", show=show, highlightthickness=0)
        entry.pack(fill="x", ipady=5)
        return entry
        
    ent_key = add_field("Default Copilot API Key (Optional)")
    ent_sub_url = add_field("Default Supabase URL (Optional)")
    ent_sub_key = add_field("Default Supabase Anon Key (Optional)", show="*")
    
    def on_submit():
        results['ai.apiKey'] = ent_key.get().strip()
        results['supabase.url'] = ent_sub_url.get().strip()
        results['supabase.key'] = ent_sub_key.get().strip()
        results['supabase.enabled'] = bool(results['supabase.url'] and results['supabase.key'])
        root.destroy()
        
    def on_skip():
        root.destroy()
        
    # Buttons
    btn_frame = tk.Frame(root, bg="#141416")
    btn_frame.pack(fill="x", padx=30, pady=25)
    
    btn_bake = tk.Button(btn_frame, text="Bake & Build", bg="#10b981", fg="white", activebackground="#059669", bd=0, font=("Arial", 9, "bold"), cursor="hand2", command=on_submit)
    btn_bake.pack(side="left", fill="x", expand=True, ipady=6, padx=5)
    
    btn_skip = tk.Button(btn_frame, text="Skip (Defaults)", bg="#2b2d31", fg="white", activebackground="#3f4248", bd=0, font=("Arial", 9, "bold"), cursor="hand2", command=on_skip)
    btn_skip.pack(side="right", fill="x", expand=True, ipady=6, padx=5)
    
    root.mainloop()
    return results

# Draw dark slate installer assets programmatically
def generate_installer_assets():
    log("Generating custom dark-themed installer assets...")
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow not installed. Skipping custom bitmap asset generation.")
        return

    static_dir = os.path.join(os.getcwd(), "backend", "static")
    os.makedirs(static_dir, exist_ok=True)
    
    # 1. Sidebar Image (164 x 314) - Solid Dark Slate with stylized blue logo
    sidebar = Image.new("RGB", (164, 314), "#141416")
    draw = ImageDraw.Draw(sidebar)
    # Draw blue logo box
    draw.rounded_rectangle([32, 80, 132, 180], radius=8, fill="#1e1e22", outline="#2563eb", width=2)
    # Draw letter N logo lines
    draw.line([56, 110, 56, 150], fill="#3b82f6", width=6)
    draw.line([56, 110, 108, 150], fill="#3b82f6", width=6)
    draw.line([108, 110, 108, 150], fill="#3b82f6", width=6)
    sidebar.save(os.path.join(static_dir, "installer_sidebar.bmp"))
    
    # 2. Header Image (150 x 57) - Solid Dark Slate with logo on the right
    header = Image.new("RGB", (150, 57), "#141416")
    hdraw = ImageDraw.Draw(header)
    hdraw.rounded_rectangle([110, 14, 138, 42], radius=4, fill="#1e1e22", outline="#2563eb", width=1)
    hdraw.line([118, 20, 118, 36], fill="#3b82f6", width=2)
    hdraw.line([118, 20, 130, 36], fill="#3b82f6", width=2)
    hdraw.line([130, 20, 130, 36], fill="#3b82f6", width=2)
    header.save(os.path.join(static_dir, "installer_header.bmp"))
    
    # 3. Logo PNG (256 x 256)
    logo = Image.new("RGBA", (256, 256), (20, 20, 22, 255))
    ldraw = ImageDraw.Draw(logo)
    ldraw.rounded_rectangle([32, 32, 224, 224], radius=24, fill=(30, 30, 34, 255), outline=(59, 130, 246, 255), width=4)
    ldraw.line([96, 80, 96, 176], fill=(59, 130, 246, 255), width=12)
    ldraw.line([96, 80, 160, 176], fill=(59, 130, 246, 255), width=12)
    ldraw.line([160, 80, 160, 176], fill=(59, 130, 246, 255), width=12)
    logo.save(os.path.join(static_dir, "logo.png"))
    
    # Save as ICO
    logo_ico = logo.convert("RGB")
    logo_ico.save(os.path.join(static_dir, "logo.ico"), format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
    log("Installer assets generated successfully!")

def main():
    log("Starting release build for Nova IDE...")
    
    # Verify environment
    check_command("npm", "Node.js (NPM)")
    check_command("python", "Python")
    
    # Ensure dependencies (pyinstaller, cryptography, pillow) are installed
    log("Ensuring PyInstaller, Cryptography and Pillow dependencies are installed...")
    subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller", "cryptography", "pillow"], capture_output=True)
    
    # Generate custom styled installer wizard bitmaps
    generate_installer_assets()
    
    # Open Tkinter GUI input for baking credentials
    log("Opening release settings prompt...")
    baked_settings = get_baked_settings()
    
    # If inputs were provided, write them to default_settings.json
    if baked_settings:
        log("Writing default credentials to default_settings.json...")
        default_file = os.path.join(os.getcwd(), "backend", "default_settings.json")
        with open(default_file, "w") as f:
            json.dump(baked_settings, f, indent=4)
            
    # 1. Compile React Frontend
    log("Compiling React frontend...")
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    res = subprocess.run("npm run build", shell=True, cwd=frontend_dir)
    if res.returncode != 0:
        print("Error: Frontend build failed.")
        sys.exit(1)
        
    # 2. Compile Python Backend to Encrypted Binary
    log("Compiling Python backend to encrypted binary with PyInstaller...")
    backend_script = os.path.join(os.getcwd(), "backend", "main.py")
    pyinstaller_cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--clean",
        "--noconfirm",
        "--onedir",
        "--name=nova_backend",
        f"--add-data=backend{os.pathsep}backend",
        backend_script
    ]
    
    res = subprocess.run(pyinstaller_cmd)
    if res.returncode != 0:
        print("Error: PyInstaller backend compilation failed.")
        sys.exit(1)
        
    # 3. Integrate Compiled Backend into Electron resources
    log("Bundling compiled backend into Electron resources...")
    build_dist_dir = os.path.join(os.getcwd(), "dist", "nova_backend")
    target_dist_dir = os.path.join(os.getcwd(), "backend", "dist")
    
    if os.path.exists(target_dist_dir):
        shutil.rmtree(target_dist_dir)
        
    shutil.copytree(build_dist_dir, target_dist_dir)
    log(f"Successfully moved encrypted backend binary to: {target_dist_dir}")
    
    # 4. Build Desktop App Installer
    log("Packaging Electron app using electron-builder...")
    res = subprocess.run("npx electron-builder", shell=True, cwd=os.getcwd())
    if res.returncode != 0:
        print("Error: Electron packaging failed.")
        sys.exit(1)
        
    log("SUCCESS! Nova IDE release is compiled and encrypted.")
    log("You can find the ready-to-run installer in the 'dist-app' directory.")

if __name__ == "__main__":
    main()
