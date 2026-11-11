L, P = map(int, input().split())
C = int(input())
comps = []
for _ in range(C):
    name, b, d, m = input().split()
    comps.append((int(b), int(d), int(m)))
INF = float("inf")
dp = [[INF] * (1 << C) for _ in range(L + 1)]
dp[0][0] = 0
for i in range(L):
    for mask in range(1 << C):
        cur = dp[i][mask]
        if cur == INF:
            continue
        pit = P if i > 0 else 0
        for c, (b, d, m) in enumerate(comps):
            nm = mask | (1 << c)
            for s in range(1, min(m, L - i) + 1):
                t = cur + pit + s * b + d * s * (s - 1) // 2
                if t < dp[i + s][nm]:
                    dp[i + s][nm] = t
need = 2 if C >= 2 else 1
print(min(dp[L][mask] for mask in range(1 << C) if bin(mask).count("1") >= need))
