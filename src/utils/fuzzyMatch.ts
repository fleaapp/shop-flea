 // Simple fuzzy matching utility
 // Returns a score between 0 and 1, where 1 is a perfect match
 
 export function fuzzyMatch(text: string, query: string): number {
   const textLower = text.toLowerCase();
   const queryLower = query.toLowerCase().trim();
   
   if (!queryLower) return 0;
   if (textLower === queryLower) return 1;
   if (textLower.includes(queryLower)) return 0.9;
   if (textLower.startsWith(queryLower)) return 0.95;
   
   // Check if all query characters appear in order
   let queryIndex = 0;
   let matchCount = 0;
   let consecutiveBonus = 0;
   let lastMatchIndex = -2;
   
   for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
     if (textLower[i] === queryLower[queryIndex]) {
       matchCount++;
       // Bonus for consecutive matches
       if (i === lastMatchIndex + 1) {
         consecutiveBonus += 0.1;
       }
       lastMatchIndex = i;
       queryIndex++;
     }
   }
   
   if (matchCount === 0) return 0;
   
   // Calculate score based on matched characters and bonuses
   const baseScore = matchCount / queryLower.length;
   const lengthPenalty = Math.min(1, queryLower.length / textLower.length);
   
   return Math.min(0.8, (baseScore * 0.5 + consecutiveBonus + lengthPenalty * 0.2));
 }
 
 // Levenshtein distance for typo tolerance
 export function levenshteinDistance(a: string, b: string): number {
   const matrix: number[][] = [];
   
   for (let i = 0; i <= b.length; i++) {
     matrix[i] = [i];
   }
   
   for (let j = 0; j <= a.length; j++) {
     matrix[0][j] = j;
   }
   
   for (let i = 1; i <= b.length; i++) {
     for (let j = 1; j <= a.length; j++) {
       if (b[i - 1] === a[j - 1]) {
         matrix[i][j] = matrix[i - 1][j - 1];
       } else {
         matrix[i][j] = Math.min(
           matrix[i - 1][j - 1] + 1,
           matrix[i][j - 1] + 1,
           matrix[i - 1][j] + 1
         );
       }
     }
   }
   
   return matrix[b.length][a.length];
 }
 
 // Check if two strings are similar (allowing for typos)
 export function isSimilar(text: string, query: string, threshold = 2): boolean {
   const textLower = text.toLowerCase();
   const queryLower = query.toLowerCase().trim();
   
   if (!queryLower) return false;
   if (textLower.includes(queryLower)) return true;
   
   // For short queries, be more strict
   const adjustedThreshold = queryLower.length <= 3 ? 1 : threshold;
   
   // Check each word in text
   const words = textLower.split(/\s+/);
   for (const word of words) {
     if (levenshteinDistance(word, queryLower) <= adjustedThreshold) {
       return true;
     }
     // Also check if word starts similarly
     if (word.length >= queryLower.length) {
       const prefix = word.slice(0, queryLower.length);
       if (levenshteinDistance(prefix, queryLower) <= 1) {
         return true;
       }
     }
   }
   
   return false;
 }