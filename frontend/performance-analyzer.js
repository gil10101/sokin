#!/usr/bin/env node

/**
 * Performance Analyzer Script
 * Run this script to analyze bundle size and identify optimization opportunities
 * Usage: node performance-analyzer.js
 */

const fs = require('fs');
const path = require('path');

// Analyze package.json for potential optimizations
function analyzePackageJson() {
  console.log('🔍 Analyzing package.json for optimization opportunities...\n');

  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const heavyLibraries = [];
  const outdatedLibraries = [];

  // Check for heavy libraries
  const heavyLibPatterns = [
    { name: 'three', reason: '3D graphics library - consider lazy loading' },
    { name: 'framer-motion', reason: 'Animation library - can be heavy, consider alternatives' },
    { name: '@react-three', reason: '3D React components - only load when needed' },
    { name: 'recharts', reason: 'Charting library - consider tree-shaking' },
    { name: 'firebase', reason: 'Large SDK - consider modular imports' },
    { name: 'lodash', reason: 'Utility library - consider smaller alternatives like lodash-es' }
  ];

  for (const [dep, version] of Object.entries(dependencies)) {
    for (const pattern of heavyLibPatterns) {
      if (dep.includes(pattern.name)) {
        heavyLibraries.push({ name: dep, version, reason: pattern.reason });
      }
    }

    // Check for unpinned versions (not recommended for production)
    if (version === 'latest' || version.startsWith('^') || version.startsWith('~')) {
      outdatedLibraries.push({ name: dep, version });
    }
  }

  if (heavyLibraries.length > 0) {
    console.log('⚠️  Heavy libraries detected:');
    heavyLibraries.forEach(lib => {
      console.log(`   - ${lib.name}@${lib.version}: ${lib.reason}`);
    });
    console.log('');
  }

  if (outdatedLibraries.length > 0) {
    console.log('📌 Libraries with unpinned versions (consider pinning for better caching):');
    outdatedLibraries.forEach(lib => {
      console.log(`   - ${lib.name}@${lib.version}`);
    });
    console.log('');
  }

  return { heavyLibraries, outdatedLibraries };
}

// Analyze Next.js config
function analyzeNextConfig() {
  console.log('🔧 Analyzing Next.js configuration...\n');

  const configPath = path.join(__dirname, 'next.config.mjs');
  if (!fs.existsSync(configPath)) {
    console.log('❌ next.config.mjs not found');
    return;
  }

  const configContent = fs.readFileSync(configPath, 'utf8');

  const optimizations = [
    { pattern: 'optimizePackageImports', message: '✅ Package import optimization enabled' },
    { pattern: 'modularizeImports', message: '✅ Modular imports configured' },
    { pattern: 'swcMinify', message: '✅ SWC minification enabled' },
    { pattern: 'splitChunks', message: '✅ Code splitting configured' },
    { pattern: 'performance', message: '✅ Performance hints configured' }
  ];

  optimizations.forEach(opt => {
    if (configContent.includes(opt.pattern)) {
      console.log(opt.message);
    } else {
      console.log(`❌ Missing: ${opt.pattern}`);
    }
  });

  console.log('');
}

// Generate optimization recommendations
function generateRecommendations(analysis) {
  console.log('💡 Optimization Recommendations:\n');

  const recommendations = [
    '1. Implement lazy loading for heavy components using React.lazy() and Suspense',
    '2. Use dynamic imports with { ssr: false } for client-only components',
    '3. Implement code splitting at route level using Next.js dynamic imports',
    '4. Optimize images with Next.js Image component and proper sizing',
    '5. Use React.memo() for components that re-render frequently',
    '6. Implement virtualization for large lists using react-window or similar',
    '7. Use service workers for caching static assets',
    '8. Optimize bundle splitting in next.config.mjs webpack configuration',
    '9. Pin dependency versions for better caching and reproducibility',
    '10. Use tree-shaking friendly imports (e.g., import { specific } from \'library\')',
    '11. Implement proper error boundaries to prevent cascading failures',
    '12. Use React Query or SWR for efficient data fetching and caching',
    '13. Optimize font loading with font-display: swap and preloading',
    '14. Implement progressive loading with intersection observer',
    '15. Use Web Vitals monitoring to track performance metrics'
  ];

  recommendations.forEach(rec => console.log(`   ${rec}`));
  console.log('');
}

// Main analysis function
function runAnalysis() {
  console.log('🚀 Performance Analysis Starting...\n');

  try {
    const packageAnalysis = analyzePackageJson();
    analyzeNextConfig();
    generateRecommendations(packageAnalysis);

    console.log('✅ Analysis complete! Review the recommendations above to optimize your application.');

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
  }
}

// Run the analysis
if (require.main === module) {
  runAnalysis();
}

module.exports = { runAnalysis, analyzePackageJson, analyzeNextConfig };
