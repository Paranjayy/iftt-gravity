import sys
import re

def resolve_nested_conflicts(text):
    # Regex for conflict markers
    # We want to find the innermost ones first
    pattern = re.compile(r'<<<<<<< [^\n]*\n(.*?)\n=======\n(.*?)\n>>>>>>> [^\n]*', re.DOTALL)
    
    while True:
        match = pattern.search(text)
        if not match:
            # Try a simpler version if there's no space after markers
            pattern_simple = re.compile(r'<<<<<<<\n(.*?)\n=======\n(.*?)\n>>>>>>>', re.DOTALL)
            match = pattern_simple.search(text)
            if not match:
                break
        
        # Choose the "theirs" (second group) as it's typically the more complete one in this repo
        # Unless it's empty, then choose ours
        ours = match.group(1)
        theirs = match.group(2)
        
        # In your repo's case, 'theirs' (Stashed changes) is what you usually want.
        # But if it's nested or messy, we just want to remove the markers and keep the most code.
        # Let's keep BOTH if they look like different code, or just theirs if they are overlaps.
        # Actually, for a 100% fix, let's keep theirs.
        replacement = theirs if len(theirs.strip()) >= len(ours.strip()) else ours
        
        # Replace only this occurrence
        text = text[:match.start()] + replacement + text[match.end():]
    
    # Remove any leftover lone markers
    text = re.sub(r'<<<<<<< [^\n]*\n', '', text)
    text = re.sub(r'=======\n', '', text)
    text = re.sub(r'>>>>>>> [^\n]*\n', '', text)
    
    return text

if __name__ == "__main__":
    file_path = sys.argv[1]
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Run resolution multiple times to handle deep nesting
    resolved = resolve_nested_conflicts(content)
    # One more pass for the simple markers
    resolved = resolve_nested_conflicts(resolved)
    
    with open(file_path, 'w') as f:
        f.write(resolved)
