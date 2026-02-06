import glob
import os
import sys

DIR = os.path.dirname(os.path.abspath(__file__))
DEF_DB = os.path.join(DIR, "def.db")

# 查找 command-hub-2026*.db
matches = glob.glob(os.path.join(DIR, "command-hub-2026*.db"))

if not matches:
    print("[ERROR] 未找到 command-hub-2026*.db 文件")
    sys.exit(1)

if len(matches) > 1:
    print(f"[WARN] 找到多个匹配文件，使用最新的:")
    matches.sort(key=os.path.getmtime, reverse=True)
    for f in matches:
        print(f"  - {os.path.basename(f)}")

source = matches[0]
print(f"[1/2] 删除 def.db")
if os.path.exists(DEF_DB):
    os.remove(DEF_DB)
    print("       已删除")
else:
    print("       def.db 不存在，跳过")

print(f"[2/2] 重命名 {os.path.basename(source)} -> def.db")
os.rename(source, DEF_DB)
print("       完成")
