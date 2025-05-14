'use client';

import { useEffect, useState } from 'react';

export default function DebugPage() {
  const [envVars, setEnvVars] = useState({});
  
  useEffect(() => {
    // Get all environment variables that start with NEXT_PUBLIC_
    const publicEnvVars = Object.keys(process.env)
      .filter(key => key.startsWith('NEXT_PUBLIC_'))
      .reduce((obj, key) => {
        obj[key] = process.env[key];
        return obj;
      }, {});
    
    setEnvVars(publicEnvVars);
  }, []);
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Environment Variables Debug</h1>
      <pre>{JSON.stringify(envVars, null, 2)}</pre>
    </div>
  );
} 