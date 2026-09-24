export default function Pricing() {
  // Seus planos com os links exatos que você gerou
  const PLANOS = [
    { 
      id: 'basico', 
      titulo: 'Plano Básico', 
      preco: 'R$ XX,XX', // Substitua pelos valores reais
      beneficios: ['Benefício 1', 'Benefício 2'],
      linkMpago: 'https://mpago.la/23RLHXf' 
    },
    { 
      id: 'standard', 
      titulo: 'Plano Standard', 
      preco: 'R$ XX,XX', 
      beneficios: ['Benefício 1', 'Benefício 2', 'Benefício 3'],
      linkMpago: 'https://mpago.la/1R6micA' 
    },
    { 
      id: 'premium', 
      titulo: 'Plano Premium', 
      preco: 'R$ XX,XX', 
      beneficios: ['Tudo do Standard', 'Benefício Premium'],
      linkMpago: 'https://mpago.la/1KQMd7u' 
    },
    { 
      id: 'ilimitado', 
      titulo: 'Plano Ilimitado', 
      preco: 'R$ XX,XX', 
      beneficios: ['Acesso Total', 'Suporte VIP'],
      linkMpago: 'https://mpago.la/174Pjj3' 
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-center mb-10">Escolha seu Plano</h1>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANOS.map((plano) => (
          <div key={plano.id} className="border rounded-xl p-6 shadow-sm bg-white flex flex-col">
            <h2 className="text-xl font-semibold mb-2">{plano.titulo}</h2>
            <p className="text-3xl font-bold mb-6">{plano.preco}</p>
            
            <ul className="mb-8 flex-1">
              {plano.beneficios.map((beneficio, index) => (
                <li key={index} className="mb-2 text-gray-600 text-sm">
                  ✓ {beneficio}
                </li>
              ))}
            </ul>

            {/* Botão que redireciona diretamente para o seu link do Mercado Pago */}
            <a
              href={plano.linkMpago}
              target="_blank" // Abre em nova aba
              rel="noopener noreferrer" // Segurança extra
              className="w-full block text-center bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Assinar {plano.titulo}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
} 