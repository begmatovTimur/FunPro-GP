n = int(input())
best_i, best_ms, best_s = 0, None, ""
for i in range(1, n + 1):
    s = input().strip()
    m, rest = s.split(":")
    sec, ms = rest.split(".")
    t = int(m) * 60000 + int(sec) * 1000 + int(ms)
    if best_ms is None or t < best_ms:
        best_i, best_ms, best_s = i, t, s
print(best_i, best_s)
