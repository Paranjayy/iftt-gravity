import sys

def solve_parity(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    result = []
    stack = [] # Each element: {'ours': [], 'theirs': [], 'in_theirs': False}
    
    for line in lines:
        if line.startswith('<<<<<<<'):
            stack.append({'ours': [], 'theirs': [], 'in_theirs': False})
        elif line.startswith('======='):
            if stack:
                stack[-1]['in_theirs'] = True
            else:
                # Orphan =======, just ignore
                pass
        elif line.startswith('>>>>>>>'):
            if stack:
                conflict = stack.pop()
                # Parity Logic: Always choose theirs (Stashed changes)
                # If theirs is empty, fallback to ours
                chosen = conflict['theirs'] if conflict['theirs'] else conflict['ours']
                
                if stack:
                    # Nested conflict: add chosen lines to parent's current side
                    target = 'theirs' if stack[-1]['in_theirs'] else 'ours'
                    stack[-1][target].extend(chosen)
                else:
                    # Top level: add to result
                    result.extend(chosen)
            else:
                # Orphan >>>>>>>, just ignore
                pass
        else:
            if stack:
                target = 'theirs' if stack[-1]['in_theirs'] else 'ours'
                stack[-1][target].append(line)
            else:
                result.append(line)

    with open(file_path, 'w') as f:
        f.writelines(result)

if __name__ == "__main__":
    solve_parity(sys.argv[1])
