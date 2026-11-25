n = int(input())
gaps = list(map(int, input().split()))
best = 0
run = 0
for g in gaps:
    if g <= 1000:
        run += 1
        if run > best:
            best = run
    else:
        run = 0
if best == 0:
    print("no train")
else:
    print(best + 1)
