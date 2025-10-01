import { useState } from 'react';
import Header from './components/Header';
import LoginPanel from './components/Login';

function App() {
  const [showLogin, setShowLogin] = useState(false);

  const handleLoginClick = () => {
    setShowLogin(prev => !prev); // alterna entre mostrar/esconder
  };

  return (
    <div className="App">
      <Header onLoginClick={handleLoginClick} />

      {/* Painel de login, aparece apenas se showLogin for true */}
      {showLogin && <LoginPanel onClose={() => setShowLogin(false)} />}

      {/* Resto do conteúdo da página */}
      <main>
        {!showLogin && <h2>Bem-vindo ao ONBOX</h2>}
      </main>
    </div>
  );
}

export default App;
