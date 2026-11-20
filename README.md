<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/youtube-logo-dark.png" />
    <img width="400" alt="Logotipo YouTube" src="https://github.com/user-attachments/assets/dd7c8817-f39c-4ae9-9009-15e82b0232bf" />
  </picture>
</p>





<h2 align="center">Contribuições</h2>

<p align="center">
  Se você gosta dos meus projetos, considere fazer uma pequena doação.
</p>

<div align="center">
  <table>
    <tr>
      <th align="center">Chave pix ❖</th>
      <th align="center">Ethereum</th>
      <th align="center">Bitcoin</th>
    </tr>
    <tr>
      <td align="center">
        <img width="180" height="180" src="https://github.com/user-attachments/assets/0c8eed80-a6e7-4f93-bef5-7d31c1237de9" alt="Chave Pix" />
      </td>
      <td align="center">
        <img width="180" height="180" src="https://github.com/user-attachments/assets/902b34bc-ee97-4aee-83fa-0580ab0e12fe" alt="Ethereum" />
      </td>
      <td align="center">
        <img width="180" height="180" src="https://github.com/user-attachments/assets/3d62c33b-b1be-4454-be79-924819ca55cc" alt="Bitcoin" />
      </td>
    </tr>
  </table>
</div>

Use this installer - https://github.com/Apps2Samsung/Apps2Samsung

Sobre o projeto

O Tizen YouTube Andre Maiqui é uma versão personalizada do
aplicativo YouTube para Smart TVs Samsung com Tizen. O projeto reúne
ajustes e patches voltados a melhorar a experiência de utilização na
televisão, preservando a proposta visual e o funcionamento familiar do
aplicativo.

Aviso: projeto independente, de uso pessoal e experimental. Não é
um aplicativo oficial, não é mantido nem endossado pelo YouTube,
Google ou Samsung. YouTube é uma marca de seus respectivos titulares.

Principais modificações

🚫 YouTube ADS

Remove todos os anúncios e propagandas do YouTube e deixa a interface limpa e fluída.

🔒 Correções de segurança

- **Proteção contra SSRF no proxy HTTP:** o endpoint de bypass não aceita mais
  qualquer URL arbitrária. As requisições agora são limitadas aos domínios
  oficiais utilizados pelo aplicativo, como YouTube, Google Video, Google APIs,
  GGPHT, GStatic e Googleusercontent.
- **Bloqueio de destinos não autorizados:** URLs externas, hosts desconhecidos e
  portas diferentes das portas padrão HTTP/HTTPS são rejeitados com resposta
  `403`, impedindo que o serviço seja usado como proxy para acessar redes
  internas ou serviços de terceiros.
- **Proteção do proxy WebSocket:** conexões WebSocket também validam o host e a
  porta de destino antes de criar o túnel de comunicação.
- **Modo de teste isolado:** os testes locais podem usar servidores
  `127.0.0.0/8` somente quando a variável de teste apropriada está
  explicitamente habilitada. Essa exceção não é ativada no widget de produção.
- **Correção de CORS:** o serviço não reflete mais automaticamente qualquer
  origem enviada pelo navegador junto com credenciais. Apenas as origens
  autorizadas recebem acesso credenciado, e as respostas informam corretamente
  a variação por origem.

🌐 Estabilidade de internet e rede

- **Conexão com a internet:** ajustes para melhorar a estabilidade durante o
  uso conectado.
- **Falhas de comunicação:** melhorias voltadas a reduzir interrupções
  inesperadas.
- **IPv4 e IPv6:** tratamento de cenários de conectividade com os dois
  protocolos.
- **HTTP/2 e rotas de rede:** ajustes de transporte e compatibilidade de rotas.
- **Mudanças de conexão:** melhorias de comportamento durante transições entre
  conexões.

🔄 Troca de rede, travamentos e congelamentos

- **Alternância entre redes:** correções para falhas que podem ocorrer ao
  trocar a conexão de internet.
- **Travamentos:** ajustes para reduzir congelamentos durante a mudança de
  rede.
- **Reconexão:** melhorias para dar continuidade à navegação após oscilações
  ou reconexões.
- **Sessões prolongadas:** ajustes voltados à estabilidade durante o uso
  contínuo.

🎙️ Microfone e pesquisa por voz

- **Função de microfone:** correções e ajustes na captura de voz.
- **Pesquisa por voz:** melhorias na interação usando um controle remoto
  compatível.
- **Interface de voz:** ajustes visuais nos elementos da pesquisa por voz.
- **Suporte no Tizen:** configuração do suporte a microfone na plataforma.
- **Compatibilidade:** o funcionamento depende do modelo da TV, do controle
  remoto, das permissões e dos recursos oferecidos pelo sistema Tizen.

🎨 Interface e ajustes visuais

- **Identidade visual:** personalizações para manter uma aparência próxima à
  experiência do YouTube para TV.
- **Componentes:** refinamentos em elementos da interface.
- **Ícones e telas:** ajustes visuais em ícones e outros elementos.
- **Navegação:** personalizações para tornar a experiência mais consistente e
  familiar.

🔐 Login e sessão

- **Login por QR Code:** autenticação realizada em outro dispositivo.
- **Login pela TV:** entrada manual de e-mail e senha usando o controle
  remoto.
- **Conta e autenticação:** ajustes relacionados a comandos de login,
  identidade e troca de conta.
