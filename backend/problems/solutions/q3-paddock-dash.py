import sys, heapq
data = sys.stdin.read().split("\n")
R, C = map(int, data[0].split())
g = [data[1 + i].rstrip("\r") for i in range(R)]
cost = {".": 1, "~": 3, "G": 1, "S": 1}
for r in range(R):
    for c in range(C):
        if g[r][c] == "S": s = (r, c)
        if g[r][c] == "G": e = (r, c)
dist = [[-1] * C for _ in range(R)]
pq = [(0, s[0], s[1])]
best = {s: 0}
ans = -1
while pq:
    d, r, c = heapq.heappop(pq)
    if dist[r][c] != -1:
        continue
    dist[r][c] = d
    if (r, c) == e:
        ans = d
        break
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nr, nc = r + dr, c + dc
        if 0 <= nr < R and 0 <= nc < C and g[nr][nc] != "#" and dist[nr][nc] == -1:
            nd = d + cost[g[nr][nc]]
            if nd < best.get((nr, nc), 1 << 60):
                best[(nr, nc)] = nd
                heapq.heappush(pq, (nd, nr, nc))
print(ans)
