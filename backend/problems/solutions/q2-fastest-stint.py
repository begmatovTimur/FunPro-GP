import sys
data = sys.stdin.read().split()
n, k = int(data[0]), int(data[1])
a = list(map(int, data[2:2 + n]))
cur = sum(a[:k])
best, start = cur, 1
for i in range(k, n):
    cur += a[i] - a[i - k]
    if cur < best:
        best, start = cur, i - k + 2
print(start, best)
