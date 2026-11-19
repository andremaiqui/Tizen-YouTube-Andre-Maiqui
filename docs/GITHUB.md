# GitHub: CI e releases

O repositório já possui automação no GitHub Actions:

- Todo push para `main` e todo Pull Request executa diagnóstico, verificação de versão, build, testes, empacotamento e auditoria.
- Uma tag no formato `vMAJOR.MINOR.PATCH` executa os mesmos gates, testa os bundles em múltiplas versões do Node e publica automaticamente uma Release com os dois arquivos `.wgt`.
- Tags contendo hífen, como `v1.7.0-rc.1`, são publicadas como pre-release.
- O Dependabot verifica semanalmente as dependências npm e mensalmente as GitHub Actions.

## Fluxo diário

Depois de fazer uma melhoria:

```bash
git status
git add .
git commit -m "feat: descreve a melhoria"
git push origin main
```

Para uma mudança maior, use uma branch e Pull Request:

```bash
git switch -c feat/minha-melhoria
git add .
git commit -m "feat: minha melhoria"
git push -u origin feat/minha-melhoria
```

O GitHub executará o CI antes do merge.

## Publicar uma versão

Atualize a versão em todos os arquivos controlados pelo projeto:

```bash
npm ci
npm run version:set 1.7.0
npm run version:check
git add package.json package-lock.json service/package.json app/config.xml tizen.config.json
git commit -m "chore: release v1.7.0"
git push origin main
git tag -a v1.7.0 -m "Release v1.7.0"
git push origin v1.7.0
```

Ao receber a tag, o workflow `Release` publica a versão automaticamente. Os arquivos ficam disponíveis na aba **Releases** do GitHub.

## Configuração recomendada no GitHub

Em **Settings > Actions > General**, mantenha Actions habilitadas e permita o workflow usar o token do repositório. Em **Settings > Branches**, configure uma regra para `main` exigindo o check **Build and test** antes do merge.

O workflow não envia alterações locais sozinho: ele começa quando você faz `git push`. Não coloque tokens, certificados ou senhas no repositório; use **Settings > Secrets and variables > Actions**.
