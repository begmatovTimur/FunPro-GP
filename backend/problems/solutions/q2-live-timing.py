import sys
data = sys.stdin.read().split()
n = int(data[0])
overall = None
personal = {}
out = []
for i in range(n):
    code, t = data[1 + 2 * i], int(data[2 + 2 * i])
    if overall is None or t < overall:
        out.append("PURPLE")
    elif code not in personal or t < personal[code]:
        out.append("GREEN")
    else:
        out.append("YELLOW")
    overall = t if overall is None else min(overall, t)
    personal[code] = t if code not in personal else min(personal[code], t)
print("\n".join(out))
