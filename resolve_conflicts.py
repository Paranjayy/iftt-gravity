import sys

def resolve_conflicts(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    new_lines = []
    in_conflict = False
    current_block = [] # 0: ours, 1: theirs
    side = None

    for line in lines:
        if line.startswith('<<<<<<<'):
            in_conflict = True
            side = 'ours'
            continue
        elif line.startswith('======='):
            side = 'theirs'
            continue
        elif line.startswith('>>>>>>>'):
            in_conflict = False
            # Choose 'theirs' as it's usually the intended one in these auto-vaults
            # or just keep both if they are different and not too long
            # For this specific mess, let's keep 'theirs' as it's more likely to be the "good" code
            # But let's check if 'ours' has something unique.
            # Actually, to be safe and avoid "Unexpected <<" I'll just pick the longest block.
            ours = [l for l in current_block if l['side'] == 'ours']
            theirs = [l for l in current_block if l['side'] == 'theirs']
            
            if len(theirs) >= len(ours):
                for l in theirs:
                    new_lines.append(l['content'])
            else:
                for l in ours:
                    new_lines.append(l['content'])
                    
            current_block = []
            side = None
            continue
        
        if in_conflict:
            current_block.append({'side': side, 'content': line})
        else:
            new_lines.append(line)

    with open(file_path, 'w') as f:
        f.writelines(new_lines)

if __name__ == "__main__":
    resolve_conflicts(sys.argv[1])
