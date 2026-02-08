import dotenv from 'dotenv';
import { app } from './app';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Mobile access: http://10.0.0.155:${PORT}`);
});
