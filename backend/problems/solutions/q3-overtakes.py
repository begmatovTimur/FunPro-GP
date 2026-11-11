import sys
data = sys.stdin.buffer.read().split()
n = int(data[0])
start = data[1:1 + n]
finish = data[1 + n:1 + 2 * n]
grid_pos = {car: i for i, car in enumerate(start)}
a = [grid_pos[car] for car in finish]
# count inversions with a Fenwick tree
tree = [0] * (n + 1)
inv = 0
for seen, v in enumerate(a):
    i = v + 1
    s = 0
    while i > 0:
        s += tree[i]; i -= i & -i
    inv += seen - s
    i = v + 1
    while i <= n:
        tree[i] += 1; i += i & -i
print(inv)
