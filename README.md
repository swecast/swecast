swecast
=======

Gör det möjligt att stream svenska play-tjänster från webbläsaren Chrome på dator/iPad/mobil till Chromecast. Följande siter stöds:
- SVT
- TV3
- TV4
- Kanal5
- TV6
- TV8
- Kanal9
- TV10
- Swefilmer
- Dreamfilm

Du lägger in programmet i form av ett bokmärke. När du är inne på sidan som har den video du vill skicka så aktiverar du bokmärket. Videos på sidan får då en cast-ikon som du klickar på för att skicka till TVn. I övre delen av sidan kan du se vad som spelas samt pausa, stoppa, söka.

För ios och android måste du aktivera bokmärket genom att skriva dess namn i adressraden och sedan klicka på det i förslagen som kommer upp. Man kan inte klicka först på bokmärken, då körs inte programmet på sidan som man är på.

Lägg in ett nytt bokmärke, på t.ex. denna sidan. Sedan redigerar du bokmärket och lägger in följande istället för adressen:

```
javascript:(function(){s=document.createElement('script');s.type='text/javascript';s.src='https://rawgit.com/swecast/swecast/master/swecast.js';document.body.appendChild(s);})();
```

Rapportera gärna buggar eller förbättringsförslag!
