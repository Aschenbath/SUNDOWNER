export function constantTimeEqual(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') {
        return false;
    }

    const leftLength = left.length;
    const rightLength = right.length;
    const maxLength = Math.max(leftLength, rightLength);
    let mismatch = leftLength ^ rightLength;

    for (let i = 0; i < maxLength; i++) {
        const leftCode = i < leftLength ? left.charCodeAt(i) : 0;
        const rightCode = i < rightLength ? right.charCodeAt(i) : 0;
        mismatch |= leftCode ^ rightCode;
    }

    return mismatch === 0;
}
