def show(ms):
    return f"{ms // 60000}:{ms // 1000 % 60:02d}.{ms % 1000:03d}"

n = int(input())
best = None
for i in range(n):
    lap = int(input())
    if best is None or lap < best:
        print("PB")
        best = lap
    else:
        print(f"+{(lap - best) / 1000:.3f}")
print("BEST", show(best))
