L, B, D, P = map(int, input().split())
def cost(s):
    return s * B + D * s * (s - 1) // 2
best, lap = cost(L), 0
for p in range(1, L):
    t = cost(p) + cost(L - p) + P
    if t < best:
        best, lap = t, p
print(best, lap)
