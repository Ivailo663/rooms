import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyBxw73lNVbj888RlqFCKBaFgg-T0LnaVK4',
  authDomain: 'playgrounds-c9391.firebaseapp.com',
  projectId: 'playgrounds-c9391',
  storageBucket: 'playgrounds-c9391.firebasestorage.app',
  messagingSenderId: '279292828232',
  appId: '1:279292828232:web:b20a2074c3516c6473d67d',
  measurementId: 'G-HL0JDD13XK',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export default app
