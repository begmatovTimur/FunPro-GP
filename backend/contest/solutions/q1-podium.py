names = input().split()
times = list(map(int, input().split()))
if len(names) < 3:
    print("not enough drivers")
else:
    best = sorted(times)
    print("P1", names[times.index(best[0])])
    print("P2", names[times.index(best[1])])
    print("P3", names[times.index(best[2])])
