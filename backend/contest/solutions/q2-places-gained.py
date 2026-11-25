start = input().split()
finish = input().split()
mover = None
mover_gain = 0
for pos, code in enumerate(finish):
    gain = start.index(code) - pos
    if gain > 0:
        print(f"{code} +{gain}")
    elif gain < 0:
        print(f"{code} {gain}")
    else:
        print(f"{code} =")
    if gain > mover_gain:
        mover_gain = gain
        mover = code
if mover is None:
    print("MOVER none")
else:
    print("MOVER", mover)
