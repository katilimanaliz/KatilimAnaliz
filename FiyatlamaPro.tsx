import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const fmtN = (n, d = 2) => isNaN(n)||n===null ? "—" : new Intl.NumberFormat("tr-TR",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const KATILIM_LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAG4AAACACAYAAADqFVwJAAA5u0lEQVR4nN19eYBkVXX379z3at97nRlgWN0AEZxhpmft7pFdlGisjvnyGeNnAi4RjEoEEaoLFwQkipoomsQkJsZ0GxdEEJDp6enZeqaHQbYgkR1m6a32/d17vj/ee1Wvunv2FQ5Md3V31bvLuWf7nXPvJbzeKZEQ3T09Yri31wCAFVu3Xu4ualfrRVoKVp0cdD9U0quPPO/Z+Q+7Fr+3mGAWyf5+IJlUx7nnh0V0vDtwONQ9NKTbDFu6eaQnUAzcEMp6LvUZPlChBqopcMiDSpCR9WSeyMaq121d3DUEAPEB1gb7SB7fERw6vS4ZFx8Y0M5+Ks7JJKl37PjtSbFi2+cCae3TkWIESOVZETMRkWBBipUigFXIrZVaGWlv7j+mo1O3PHHexc8nEgnx9Dnn0GBf3+uOga83xlH30JBWV4ubtl0TzLq/EDNaF9LunCLFDCKNyRwYMYHBYAEoUgoMUNQvMr5cIRcpfWHDiqXfAizJ7emRIOLjOrqDoNcN45xqcdHmkZWtudDNEaPlEtdEBVypGRCkEwBYU08wmQYQmBgggIkhapDQhVab50XGlX4oE8p9aXTZqg0z2zjR6YRnXIJZ9ANMRAy+x7XmkUW3BgreGyKlMGQ2byiNNcGiLitMgMknm3EAC4DBEExgAEzMQkJSOKjnPBkutvCdO1tf/sbT5165O5FggX4gSXRCOy8nLuOYqXvdurpaXD2y5f8F88HroqXIeZjMMxMrEGmAg1F17pnfCARlSZvJMTSPmFlCgKg9IjIi9UIukv/y+lVd/wxYdjQe5xOVgSck4+IDA5rtMCzZMtIVzYRujhixK9zTBlSpakCwDrK7ziDlGIbFJJOJVJdAEANMcFoxWxLBbAjdrctWD9L69P2p9vKXti7u2gKcuOrzhGJcglnYK/ytTz8wf8Hk/E/4p8VNkWqEOF00WLAAkQDX+QDAckJsjhCDJEkQNCaAwQaINXKoU/N9gCJ2qlRFkpQWDuhZbw65cOkXWV/xa9uXrR4FCPGB/9JOJO/zxGAcM8UHIQb7SILj2spNn/1oIOf9WqzcEhPjBWawImGqRVvbEZtq0MlABksQC24JUJGzUIIREFHoU1WgakjWoJnMI7CY4UBaUkoMCQVBrUFKeaY5Fyx/eUN3Vz8IKj7A2mAc6kTwPo8745xq8cLtGxaHp33fi1ZiizwTBlCTBgvoQMOO2cwiEJQw7ZeEUppBhJifsuEi8u7s3UV/7QdMgrxF8e5A1vvZFqO1HZN5xQIgS2qb7Z31vWEPDSJoRoefMsHc9kywmNyyZMmvgBNDfR43xiWYRRJgEPF5W4ZPb6kEvxbMev44nPNryJelEhBERPUJZUBYjBOWiEkhmSQU+b1aIVxFLlK+r+Av3zV64bJ1zrbe/ruhk1unQ3eHS4H3+9MuiHxVKg0EgqV2zecRGtJrtsuAgiFCfj0XKCAbqQxM+aZufGLJxc8zM/UNDorjpT6PPeOc3iKDVmzY8pFQ3n9HtBJtFRN5MFhBCAGHMrLVITHVJ5ckG9B13Wh3I+VPP5sO5j61tWvlQ4AFZz0FBvqxaMF7tO3XLK4BwJItGy4JFwPfjhVjb3ZPG5DVat3+2e2AgCY9SAArpQggagtTyjU9lQ+VvzmyeulXQOB6W8lj630eU8bN8BbfEckFvxcphrvcKQk2DIOJdGG77TC9PtsRsSeUWSmhCNQeFml3ajIXM27639Ne+fddJ5kA8tODg7MhLGZKAJQkUvPH7vWfqU76v6FJ1+dilZY3YSoPVlJCCM35ETOYN/UmW5E9KRhCd+nVdhcy/vyWtD936+iyZQ8Ax159HhvGMYtEP5BMkjr1haHom16Ofcw3rd8aLgddKl+UTBAEIluyTCfB4boToMBMClIEfHoxXEMmUPjuVGz3Hb+74PIXgeZFsTdyvqfl2R+F37HznK+GUp6/CBuRgErlFBM37N9cRAAzM5ikCPn0vLeIXKj8o+lg6q7Hut71O1N9Wk7WUaajyzhmigNikMyBrNy49UPhrP9r4Up4gZgsgllJEGlOqEqJBtOYABYMkmQI3aWrdh/SYnpzujWb3Lx0xYPAIeCMMwL7tz8+csZJO6PXh4q+j7lzBFWpGCBoRGQ7oI2Avt5HAEopwURoDVHanarlQ5Wb1/dceLvZBBP199PRTB0dNcY5V/c7doyc0z4RuDlajf6Ja9oAlaXBgjViIhsQRlNcBkvKlBJKMNqCWtaVeSHXWvu74fmP/SNO/0i5e2hIH163Th3y5Mxg4PINm6+IZoPfiVSip2MqD2ZWJEgQW3yrr6TGpDExGDAECV22+5DxZkcyLZU7Ni9efB9wdNXnEWdcfGBAG4jHFRFx+56B4DnPnHFrKOf7RLgQ9MhMXkGABExnYJYXYNsTZiZFUgS8eiFqIOvP/eDR8/9wfaqlL2O3ccS8uURCdKNHDCd7jTOeeziy8JWWO4NZ94cjxaCb0yUDAhpINLksLABS1kKz1Cex2d9iCyPtTv8kFc1/6bF3rn46kWDx9Dlz2N3DpCPHOAZ1r2ukXJZt2fKnkVzgtkg+dKo2VQakkqyR5rRbNhJVR/ABkGIJITS5IIi0Pr01E8x/ecvy5Y346SilX5yLYfHWjctbC+FvRMrRJa5dFXCtKlmDgIWzzZmFIECxqSG41a+l/elyJli8adPqZX93NPp+RBjnHPSibSM90WL4lnDG2+vLaECpKllAEAtq4PWWSw80VCSzIgXm1oCW9mfShVjtS893PffdV6mvdMzyZQ71efKmAd9p2pkfD027rouUIgvFZAmAkixII3YYvpmPIACsJDRNkx0+pHyZoaw/c+voslXrgLr6lHt9wAHS4TEukRAJ9COZJIWX7/KtfrEnGc55PxvOBwRnioo1AERCKMxaoQ2YSrGQQlHQqxVbGBlf+sFJ39S1jy+9+FngCKvFAx2WAzNd+NJ9sTNfnP+5UNb/t6G8T0e2JBWxCQ80hjULvK6r+0hAz3gzqhjj777avvurv3/bJTuPxLgOlXFNmeiVo6PxUDb41XA+cJY2WWIoVqyT5gSDnTkyFtYvFUvhdmtGREM6kN2UDhXvGl227GfACZCVnuG8XDi6cXW0GLotkgks96QZqlozg/dGmqJB9UUJgFkSQ6AjQml96uVcpHbnyMmPNxysQxzjQTPOuVIu2D50Vmsq9vfhvP8SX1aDKlckC2iCG4814zKLcbY7TUoJFgLRAHL+/M5MIH/H+p4ld5sfYEI/6FgjEXslZoo7oK3lm7f+cTjt+Vas2rJAm6pA1aoSgrSZM2klbEEg05FhNoTLrRttHqQ9qcfSocynDifzfuCMY6ZEPyiZJAVOuHvXXfXRYM59e6gcCiFdUEoAIBKkTEyRG7qxkT5hxUKSoqBfK3pLXAhV7ny+befX//DOKyaON/a3P3Jm4t/8zFDbyTvD14Qy/k+Ga6H5Mp2DIqVICEEW8lMPbdBIOzEzkyRJYa9e8JaMYov89u/bXrrjpXOv3A0cnPrcP+NmqIwVY2MrQ3v0u2NG2zvFZAEspbQz0c2PbQQ8TACkksLl0mSLFxlP5pFMrPi5TUuXPgacGGj7gZKzrO+Mxx7sOGt3xzeDWfcH/bUAyWJRsoAQTNRgVmOS7eyGghm8i/YoZUTq+UyseMfIyhd+COqrOsH3ffVjn4xzTuh5jw2f3jEV+nYoG3i3P++CKpUkBAkQ1WMyZ25MWPkyZjYRhliAsoH8eCaUv3Nk9ZKvg61JOEHyWwdFMxbzso1b1sRywTtDxcA79VQVLKUZ+ijMCHvs2M9iKMNUn61upN2psUxH9dNbLrhwI7B/73NuxiUSIn5OPw32kTzr0fvbTyov+GxwWrsmUopEMZ1nFmAIR05r5qOtoFQzoCjo0/L+IrKR0uBznbuvfencK3czmPrZBH0PfxaPIzntH4O61419LlwM3BLK+4JIlwwWLIiEYHADKHekjQiAAiuSYAp5tEKwimywdN+Uf+Lax7sufWFfmfdZjHNK2bLNWz8SznpujBqtb9J2FwBlSBZCq8NAM59ke5BSSXK5NCPqQjqYfTwTzH5udNmqh2c+/41CCWbRT2ZFy/mPjryjNRu+O1qOdHsmDKBYNViDRjDhPdv2150WiwNm3SeTiIYoHcim8/7it0ZWf/1W0KCMDwxog/F4k2aqMy4+MKAN9MUVgfjsJx9euGBP+7eilchVngkJVTEbB0C2x+gUf8CKXRQrUsRo8WuZYH4qGyx9fWTl7XfurfE3GtUX5UBcW3naDf/Hl6IvtNQ63qrtzoGZJQRpDNNRazItVMc9IQyW5NK1apsbuWDhd5lA8WY78+50XkwuJFggSQoM0b1+9KZQNvjpcCXYQpMFK1NMAmh2b50JRwazUFDC69UK7Yy0nvrFqwvTf/2/b7noNfPxjYD2DUMJFvE5MMgEs7iVhGIwTt3x8+hp+VNuDGQ8fx2tRPw8nVdMgGB7PlFnWj0TTwArZsFQFPBq+UgVuVDpuzu9L9z8zNL3T8WZtUEiSTYXl65bd3lLrfPLoaL3nfp0DWzUJJHQnOLhzJMRCJIUE0OSpusy5kbam3omGy7esXnFih8Cr/+NFXuhJvBhb2RPMABcOLphcaQU/mJwWr8qWPBCFcuSBQQLIrLdTp5htYgBBcUAqD0ost787zPa5Kc3XLz6N3FmMxV24YYN53fkW7ZFU37dKBbMfJRVzlZHPoC6DWPBgGSpQdMoFkDGl09nw8W7hlfeewcoecAu7euNnJqj+zebzpJudG5Ys3zjXj8wK3W04YpIPvx30VLkLSJVgWTDYIIumJqyDU4HQmkMVspwefx6MWQYE6GJyzasWfGIDr7HFbnfe08069dloViDIJdQVLd+DUwRgDC9RWZIVySsF0WunAuO3zPemf3m7y7ofREwV1qS3nBShvjAgJYkkpfdfb+nsLjjL8th+opIlScBnAVmmnOREvEwYCSYBQAkie7Hs3c/0r1r1YeCQr8zLGNRTDsy77DSRVbJBgAIRQA0XRXLRgA+vYLAPec/un4ZLRvZcvX8dPs93l2Vetplr8CpYkNoul5rcSEfKN2f8U59aeOqVVvsgQ329Tng5DcIJRICAJBMqt4HtyyqBPnLckHwsqoswbezum3T6pVL9sq4mY9ySOxbdgyddvJE5IZoKXSNNyNMuFCDICaqS52NvtjMlGyozoC+K7D7G7ovR3FPwSpQZIdedKYOTaiGuS2kp/TpXC44ff3Imq57gAYYPPgGlTLb+ege2vrpSqv7GyVXCTIzUXW5Ay5gJmK0b7KYZtrIC3pf/D3wsRUjm34ddge/ES6Fz9RN9ckQwqpLJDhjZRYQesZgr9BW6ZoUXShUiAlavb6QmzJnTLpGxQ6ijG/8Hyfbpm974ryLn4/HB7SzB+KcJHpDxWQAmgLrdw9sOil9sv7NckT7QEllJFcVQNDVLFj5wJ8+3NtrmCDHOTS4avmv5r92zyNveW7xDSFP4G8C03qQqzUmCLK9d9S/kUC5Ck1pi3W4RJChQIJsGAaADVkpJhLItNfSE63TH9natfoXgCllg729xvGvgz7yFB8Y0AaJ5CAgu4e29UwF5X/WWrV51XxWCkUaBMwyWXsX0KFSMqkG7fZO6ivuAm45+8mhfztVRX8Ty4TPVJWKIoIgtmuCrSy7AIQEC0jFcET0dg2hIoaQJGW7n9KhbHJr1+pfxAeedCOREPtzhV+nRN1DQ/pgX5+89L/H5q/eMPafpTYMFQO1edVcRhKgNfKIR65REy5jij/5pPvpc3v/kIqWbq2GwEKSVUvdKDS1yzuYQLqV3Wwii3kMoWlFI10pt6hfmcjHOQb6zn1jBdKwVn28Tw1Tr9H74OjqXET+pNrmml/NZxQUEwnS2LI1tsN3RD0wIh5kriGREJMB44HYZLri0YJepSTDrhMkNGpNGRDm76z/ZvZIgJQyuMLlvGWk31geIwAkWAz29ckBGhDdI2O3FzswXAjX5lcKKQkBATtGtuZGWateMB352UgmVYiFy3BzvQCprpLrP5pOZ9O+6fomQKvyyvyfUHN5D8p7et2Q6card927Ydndnd5+o8NzSSE/oWAwkZiBGgHOxNpRW8Iln2RyNGbbuKbkNEzJ3y8RyzecpMUHWAMRr3pwwyWlhf5N5bC6pJiZMIQiUa/7dNLM0oSj6Zjtxe9pVob7+vQbmMbb15nKxqX/aS1IqNTyFRJCr7vf3Fwnc8zJLFqp94Vn8MNknKOzDVa/AX39uUjAIAUGoPGs6dkHHUWOOkqt9io/B6Qq39DETEoza+zsMuU6PktHWSUeBpmMs9UCmj2lN5CyJPC+WTDTSdwfw+gocnR2mnv23wXPeAO90VRkImE6ZPsAgU/I5NMsz7WZL3WJc9ZDmL+qAy2vW+oeGtKRTCow8K6fjbbu7X0nIuNmS11zJ/X6Hy1V2VTMgtepi2IDuL29xkX3ji2snur9h9J0RgF4rzMz3aATdJR76RbBZpxFMxfeCbgQ90t2KmYQQM/wY5fm/MV/EPOjZ3A2/Yu9fuhgB3rEMa+Db1+f+RsCQYFP1DW4dzKdDxokkr0PbHiLEfH2l2L8wVKtClcqJV1zbc6AZSuoUU9zQHQMJsdp4hpw8j6QExsjs4s4Xw9SZ5YGEECk1gyN/YXR5t9RjvEHi5WUYlY1aGKfkB05KqwOiI7lpDSy2U0htn7MO3KEqXtoSE8SGfG7Nvl2D2v3FNu1D5WMLHNFShJCU6QUcMJasb3THDxx4iNNyIlNTi/rhB1wIiHALIZ7e41L7h1762sr9G3lefqHCrWUYqXAgjSAIZSA2E8i6qDXrV0LebRpRhPOJl+XyEndzSdSq9eNXps+yRgrxuQ55XJGChaCyNotapd3i/0w51BU5DFc0c4ta/ZLfa/vtj90Iolc49wU49Kfbz6tsMB1T7lFu6RcyQIlqUgIzS7ltlNZSiirAvt1SDPCNAbqLlbdxs2U/BMOQbFK4AYB2TO8/Y+zEf56NUKnVXJTBkHToFGTXB1oaKP2+dcZ5KwxPdpEAOwiWZ5tu/YrcScEWUxb88vNnbV211eLEf5/FapAZsqShNaUigEOUUscRHKUDrmRQ6CZ/TpQVXnciZnQ309X/XxHZE9bcb2cr7+5nE1JYpAmNE0dyGwf4Tk28d2jK3d1DHmmsNlVePt7wHHH8awzsWTQFTbc/OZSPiUJEBAQ9boMi/aahtnfGOwJOt5jBeCqeeoHhM8q4gLqfa0z7oRyQuYgoyYVFFeEvd/8SObKmhLIB0FHfM6YnjhvfLoOlOzj+U1xnHMiGofInEgcZVGXqoPh2pEYAjf+Ofe6HxFKJESi3yzAWznc+TeBkt/FrJiYaGZMzcLkSxNyctzV4n6ovu0Ls2swjk0H0JDOI9S8DYonkcTq32791rzqgk9p2ZxS1u6P+qm4jYAABKeNm5nDOQ6CFh8Y0GBtSTqidBR4fCSmx66cPuvZ+9svenjH8Lxs26fo1ayhhBIg67gNMqvKbe1n2j7mhlc5R+AzN55+FGjGgaR727Z0VGtA2PH9ANo43LWw6J57XMO9vbVFG4fe2vFs9L9aqh3nyVTaYAHdvADDygdY27cBAMRgyUwkqHl1z+XFgAEUD7Obe6f4wIAGIh4kkj1rRy9dsXbTj9Fcenps6GBaOhyuMVN3Ykjffs01ta5N6y+bl+l4tCUdPo8nMwZB6EIKq9TcVpNmx5gAlizJ5SZDSNmcSHV2/qibEKbuoXXaYG+v0f2dgSDe+aa/Kvlqd3FVZeODmz2DQOlo96DRE8cP+8g6N8VWh7KkEgkBIjUMGKvXbr42uid4ZzDrdstaWZIm9FlpNLuchABWSrqCQS0TyBcKkdr766cpOG1cfZPBIfTtQCg+MKABxMO9vUb3A5t75NIzN5Q6xd8VXEVJHm8gFaRF1vuaNIId2xyUE3UAg6g/dx/vmXmQ3MFSfIA1JJPq1Bd+6O1dv+Pr8ysL7w5NuFyoVFmw0OwSyrmeTxI1LRzUMtHyY+Ox1GUj3V0P7Rs5OQpSZ++ti9+1yTdxof+vSr7yXbWwoVfzaYOIBAGCNH3vFVkH2+BBjIHtL/tIcx3KlJhjJuPkJwdazvzDWQ92FFsX00S2JoXSBQuyERGnDbc9SSHJ4Hkh14R3ctuz7TsueemCj6S7h4Z08/qTfUzHkQtyrV2evb3Gmge2rNoVc91daxMXFIslRomVEJrOpBQTgH3svjtULXXAdISrF+IDA9pgb6+xZGSoq2VX+3dimdAiTOcM1skFEFgBsFx+G0xmAShWrEnNqC3wuSZDk994rePFxEtv+0jOPgSnEcc51GQ98D5CM+Tc5dmzdusnigF1dy0i9UohbQiQDjKP5lBkF3rugw629Mx+74E8dy808/wt+2Rf4n0dusMUHzDvILhw4/or29LRn8YyAY/K56Vyke4sl2BL3Ow78JiVIiIqnxFwTeg771zfvfRvAcC5qbRZVR4F1WgHmJf90/r2wlt9/1ZudV1WrKWBslJCCN1u2OmNn9BkpluYwYoB35zvsc43GeztNVau23Rba6HjBv/uGktVlKQJzczI26sAdfSYAfP8GJ9HS7eWKinva7dsWtl1h3kNTD87j+pvYhw5lCZDHbwj4KAEs3jaqrrqeXjbVdkY/Z0RFmeUSlMGQBoJqguXrePri35flvdg+3OI73cKKjlesGQJXWh+LQxhZO8FgPjgoBgEzBjU4TmuXLv5q/PKC27wvFyUUihBQmi2jBKEeRsXTJYpAZBkRRGflmotTU56Uh/atnL1b2z7OLObRyWt4zzPY9Xw1q9X2vTPlqgIWaxIsqTscEOPg0ad9qdem1bR7BSYdcKt4Q6EdL2AKdfL+RuH1yz7ARKJ+qm2drHtWc/eHz7tpXn/GstE/sg1VZRSsBAQxDM6TMpSjYIZIImoX5+MpDe/2PZq/H8veM9ri8bGXMOLzQudnBQfGNCaKpnB3PCsQI2iQ/gPfIKYKUmkLvn58Cm5+Z6/L8XEeyrVtIJkQDMP2AaOAlB7GNSwWaZjYP6y8XcCoNgwPL6I7srQtsB45ZpHrlixI8EJkSRTfcUHTKa9deyB+ae80PnfHZV5y9Rk2lACuh1MN9AQU8oIABSzxkIZJwX1Cff4D9a+a9E1IHB8YEAb3AvTBvv65CznpFk3zBjBfsiWtFWPbFmTadF+WgshVivkJBE069iwOc8aO1AG1gPgg/3sgcRy9hdHDMsE81QfsOELt+vuXcWHFjz4ynsGk31VsyzQdBRsdbZkw7pVrZNtP4ul/G0ynzJICF0wMFPSYD1bsVKarqHUoWvTnl3fmm6v9Cf6mZJsmpjmD7Dpy/SRXDa8cfURVZVPY5AAwPDITxot3lgtlaoIIs/ekPyZ9vNgXf0Dltj9BNfOtp0qmCSYWCifO6S7Xqt8J5Lyfs1m2nBvr2E6IdCGe8lYsnHjmrZ0+JexaV9QlUuSSOgztC+ctySTVFIEvFomVqmlYtPv27Rsyb0A8MRcOK2Z9gERqTUPP/otV03/1AzGzbYcB6POxtFOACDBz7JSzII1u75qLumoB5v1Jo+v7qzfbiwAZqVcrMPrimja7uLNgSdTd/76uisqdZecmUCCh8HG6nVbEi2pWL9/nCFlRQmyKqcdnGPbBhEAQxkU9uup1uLzk97x67Yt672vOzGkD/fPcQcBs2AyT1/v/u3Wf+8sz/+zbHm31OsqAg2960y/HsoGPiIWEHZNzf5Vbf20h/2oZar388gTAY1zOKWSmsuleco6XBOlPx++ZNmPwEy41jylwXZCOh97MPDWXOstbZmWv/XsrDCDIeyzqkFNKsVK0TApMjA/6hoPTD75XPuLF71w3lV76hKcnNEpZgEiRUMJb6+x7Qedxfl/JnZmqtzB7jlVpQ23HLOYygGuHq84jliYXh7YcAeCujvFGXfKuGrdFcuGu4eG9GFAgohtMOHkJwda3ryr9ecdtQWraVfGYMetH2wBCfUxEQClWLBA7eSAayI08cNp2nPDC+ddNb63M6ptZ+cdmx84rb0w/76WXPgclc0YcJG7kQFvGoHVGA6nzFk0c2J/QnvQvv2RJdPhU5CCpMcb0n0peorGi3+57qpVW5wTu2hszDW4eHFt6ea1S6N7Ov67Zdp/EqXTBmukA+TUjI1lb7qkUmhuLddaM9Kh3V9fv3LJjQCwt+O1Ft0z5hrso9rbtt93aufk/EfasrEzjFzOUC7owlLnOsNWkQ2OHb6brpqZdSQBRsd8HAyv9/VeUsxKgxFwRb2e8dpaz2jqvQ9ff2mhO9FgWvfQkD68eHFt0bbhJa1TrQ/GpvwRLpQl66TPOt3V0ZhiJTWfR8u2ydKUf/rzm1au/Pa+Li00F8ri2tljDy88ZaLjkdZ05AyZzxtCE7qoNeywbrZ3pJ2CA5fVmcj7fntyoHbuIBYLa0RBRLze3cYPuocu/FgyScqMl2zPcZ023NtrrBzaeGXstciPwjlfRJZLEpp5lL8zlLJ9BgZACobWGtKnAlNP7IpNfuDxpRc/u6/j++2/da0beV/Hnra7wmnf6UaxIIUmdBPI4npqyXRZmQGiJs/vsLVXPeDcN1hdb2/Gyep7/4AD6N3Hew58LbIMVAOK90zfvO6irq+uM3cBmXFUImF6dOg1Vq/d/Pm26ryveaeqULLMJIQGZuvenEZ75lmtioUhJM8P6dOeyR889bb/ve7VhX0lO1MwVy/iA0+6B3vPrXatG+nrKLb/V3DaBVkuSEGaBsnW+a+NQTXbOJqLYcfI+BxJoZ8FJsymYfP6E2hw3+TdVbjtwYu6XrR2tXLdCenrk8RwX7x2x93RdOhjerosFStBQtRvviWHRbPsmhJKQ+0Unz7h3fmP69YsuRrY54VHFB8YEIN951aXrRuJtxVafxLcQ0qpMhOZi6NpXNaPdciryc456VD5Rge17A+ombkQiMMgBoDh3sWTACZtcBhoOCEXbLzv1LahU37ckW9fzpNpyQIaQTSGxhazbLiMmDWfT2TDJZ6M7PrzzSu6fmQj+3MyzXESbc/arbdEpvz9vryAhAFBDXiw6SPWlOr1n/YGYxyqJLC9c3k/DzgY/h5sf/atpa32zb0JtqNgOyHnbVx3QWeh7aexTPAMmU4Z0BrwldOc1IfAYHYLTrVXnpv2pPq3rFj5HxYEOPdZ1Q6mdQ+N3tNhnHQ1ZTOKlSTzRHSa03RQk8Q1d8D6zGG6LAcqcUcZLGngm3uRV7IqThxOSNfIyJ/HcrG7YqlAmyoUTaZZ57vPNCV28hMMJaNubdL/6ve3ruz+j/jAk27sLZdvbxnjBK9eu3WwI9/+AUyma2DoROY52nUNSM2t2d9F4yXVQ4H6e61RM1UOaXoPRrMdFEZ5oM+0TlRlM1e2d1yWmRL9/TTc22ssH9r0N/MqJ/9rdJerTeWLSoB0oSy202xFVD/kQLDmmqzy/N2tt3cPj31tsO/capJM73RmWwBw4ejDrWt+8+5fzs90fEDbUzJAcBHMe+caaNVcIKs5pkZax9kZAsAMMm0fc9hV3d9ZWLMnzfq3v228R5occR4pZhAprx50C1nJzPl+23Pkp6m3Z8f1LYXwHe7xiqEghSAhmhKrbENjjalg66t1cjwFpjX2+uZ9/uLh37190rXrusHll/1hrhBACwSYpuhcXWpgRQTrqiOnrzFTJTtpVsDV6BRBsVJuze8KPo+zQMRnDw669jtxAJikqttvnm0+90oHsDT2GUhbE6uxAElI1ol8etjtejH7kH8KnwEzDTqOwu4eGtIpeasi7tfWPPL5X3bm2+/w7KoZiqUuWNQvLpoNjjOcW5adA2ABEjuztY6p1is6swseOX/zQ28a7u01rh4bM+eOiNHfT1vOXT49flJ+1e7Y5CPVMGnExIBSsFUvGu3OiOkBADozN7XfOAsYxMzKV/PobeWWfrzwwz96+vS+suO6kX0Uygg/iBhM0jyw+wCj7MMUTVvNs1RSCwQ0rahKngz/2fqeJT+f+d74AGuDvWTgyYT78vvf/9Oo0fJujGdrTOTSWDR3pR7gWs4/N2B4e1cTcQOfZEEuNZk1Wr2BhR7j1C2B4U2f+f7ixf/aVDvCTE8QvQrgolUPb/lyuytykz/vI6NSktDtGNFuv3l+GMxC6C7zwgG2u2Wf58WAgCZzedUyHbz08mcWDa/YvPniJJFKEqnuoSF9pvrsGJxgAHBJ16inIEj3+jxQLKH2HS/XN/EdAUeFmWua3695C9qO4Dhdtr5n8c/jPKDV+8psHVNPcvHG4eVXvPSBbS25yHswnpUgMqWCZztmLACGYgW1j5MAGoEwCdJVuaKCU6KlcyL2L+96+NGbB/tIIpk0546IkUiIRIJFLfDyV3a2Tr43Fyv/XouGNDAbRJb2c4hb/Zw1IUhw1XiJdB2wRK+RE7CuGyMhKFPmlqngko7xlocuGX7i/iVjW7qGe3sNEHH30FDd6Ntn6G9ctfTHvpdLazxZsc4bimlEglixtMe2tzHXV/ne6irnstX2xyVYqwrD72t1+VP0UnhH4dKhS5euXzQ25hqkPjPPxUwJgIZ7e40Vwxs/OT/buTGa9p+nckVJZMJXZDcEhxNCBGalhK4TaRopVsyicSJ6o3vsmGSABAlZrbJ3Gqq92nnrJWuf+Nk7Ng+dNtzbaywaG3MhmVTJJKkty/tKW3pW/er3Z73UOxlNjVLYr5MhDCiu7x4gZb0iwNBkSVS9clQFXUwMxcIEhxtXtJB5m5IQZFRKyrtHqvbxyOXtuwJD3SPb7z77yd+02Ea37j0RcYJZrL2sa+iS6wsX+3fJG7yGv+T2hzWSrEhCzV5JB6YlTceg8U8o67Yng5WARn5vTHdP1H7sfkEu/c1HV090Dw3p2626jQSzSMC8l3X5pm2fai90fCf0GikUqlKQqF9P4+wIw9KQBksRCYrx9kw6HSsUhM9LLJVsci+p/qXeT5gLn1hA0GuZWkeq5X3zM21rl42OXrp98eJaIsHCvnQpzqw9c/blux68+B3Ldkf2fF+eHNDJvBu4sVwVJIc8bOjyQb0UMr5TKBX7wqSxsi4INlnmmFwCzEIlgKfzMqzp3hBi1/qy2hXR0bHbNwV+9W+D5/ZV7es0bTc4Ge+RILp9zb1jD9eqdHvNH7qoqhswamVJBIF6a434iIC9Ou6OQtS6apcspRb0a54MKq5U+ebh3iV3mm9mGrbu/bGvEAND9AyN/XdLru39np1FyQxBRE0GrSkcIgYk1dARdk0GJn/6yknFa4N5nmdk9YdaM5E2mixK1ti8mZlNVpu5uMa5JHXSyGVMZYzWou90V038ZvXIthuSq+h2u3+DRBLMItEPJJN0zarhLTJ2Suzjwd0EqaoKmhBCaqrkKmv5YOUusbVr5UjOl/seFrbopFCVwqHDqdH/+m5QjTSlKVYTGaNlOnDWglTHD9418b61F45uXD3YZ6oke8MeiBAfGNDWvnfxoyPLFl3sS+uXerL0nDsQ0WDeVihFfcflrAU/i5zHDxMDzEq6Q2HNl3M95Z1QVw73LrmzbnstNHHR2JhrsK9PXrBp6KyLhh//ZWe2/f2uV4uG0lizwqbG89EA2pkZZEDySSHXrtDOnz500fl9z5zdvWtsSc+O3a5dS/a0Td9bnefRCALMSjq9T9ultwWyLn2CdFmpqMAeUvMK8762Zv3v/mvRyMMLTfRkSAeRSvaD4wOsjXR3fWI8MvUn0ydX0/B7BBlc0U5qdeW8ue+Nrlq1QcQHWBufX7p+t+u178lTQm5BOkHBYCinuTPr2a0CTqGIBEiXtZpyv5iXnbvCK+ZPtQ73rtv+nTOmByLDvb1GfIA1MJt2L8EiwSyGui94qP0p4wL/HvlFX9VX0fwBTbFSzFAEQEjab+jAwpwFJbjm8gY1/wQ2+p+Y7h6+fPlvF42NuWzbCwDdQ6xvX7y49vatj7ylI9c63DEVu5LGCwaBdCHFLIPZODlQMZGQ1QUebbd310/Wrfn1nyT6mcDmOB7vvvSFtd0XXLWndfJv8/NhaH6/xqwMdtTPs+MFOVUoCQGC0F7O1TqnW/taSm1rz9/y27OHe3uNRfeMuUDEg30k4wOsbVm+fOCV2MuLp1vzzxqnRTx7XK/9bPzk8S8kEix08wL13vzTwMdXrt+6K9zhuy5aibbwVB5gJUGiUQtpLx+2HRcW7CJwoaSCeUKgo+OTvk2ui+YPb7ptsJv+1Zy8IX24BzJZR9xX5gB8pfeBrT+tVnG7Kxa7qiqLUJWawcLKkvBseEoJYY5fQikNMhRe4NJfTN8z0rP0YwzLvV9MNWuyaNH3x/ThXqotX7fhitad0e9H8oEFRjlXE4Jc9UhuhrcGsh5PuijOF9pEdPpjG5dfeE8iwSLZb2YNkrCqtAdBgyvpzgtH122oudrujhWiF2IiJ5VQgmDuwKmbHGdzFiNZZxcmM0abN3imR3q3+9Zv/Mjm1Yt/YpubQSJp4qa9z/mH7usuhdX5GxYt+g1gVoLpTm8rSXTr2393/z9XJuXHg+y6PmSEXSqdN5R5Dauo2xj7u7KvCBKCBYCJnBHzBN8SVKF/ufT+He95sXPi2uFFvTsBx2WvNrh6+ZLfA/ij3nXbr9YDvi/Uwv5Ty7UMc9XIKoNTAHD2U08xzjmHAEBqpXlCc0kX2OUydOHdWfmY9rLn37nR93oJeHzwHBq8ZnFt1dotH20rtv2jP82Q1aISmnDt9SYqAqBY6i63lmuT1Unfrk9vWr76nu6hIT3ZQxKOq6PsGDY+wNrgUtqMFxKrL3nufTdFtMgXPZMSUlbr9yc6Pc16UwxAEViQjlJNRna5vK5Q7Mc9a8c6B9csvtvksmWjEwmxrffK3QB+41xATcrCeV5x16ZNS6KZ4M1hGbnSlZJQ5bJUGgvzCAezV/ZeZdtKKVPNKFLEWiSo5Vy5yXyscs+Ot+++Y7rtiiwzU7/l2SHBAugHkknV/cOhqHyT7+pKgJPeQMzrfTbV9fCVy0bjAwPa4FNPMZJJ1X3/lpNrJ3tf4Uptpzctbxy6uOvf7AHaqrGe82JQ79qxz7emwre5sywlGyRYCBuuajo0vB7csiGCfj0dzO7eE5q+YqynZ8eBXDbvvD66Z+3mP45Ohr7tK7rmwZCwi4ecJqcu5Q4/QkGxYMFqflCkMflPr5ya/nT8nJ5iEiaTZu2Rx1xhkaPIEwBWbRj9y1A2cF24EjpXpMpgKSWsQ2IEO9WAA6YhAJIl6ZqGtiDSYvKpTEv5qxuXLf1PkGl8TRVN7LxyevWDm97DXv3yeXte/JSVv7JuIyReOfJ4TFD1HyhXu2f48mXrupnrlVdAI+2/aGxkYSwfuaut0PoB2pWRDPNGqqbzQpwSQAAUDBHy61OxzIs7YxNX/m7pu546EKbZjAMsKeS7PavXL9/euSt8tisrASJyHlDeNM3kfM3MzNLlD+j5lhomArvP37hq1e/2dX/6XjGABLMwBYIU+GpXz/DVt4RyvmtDpWAY6aJ1k64QJvregH3qgTQBzIpJkSSfR6+1aEh5MmtT0cL12xcvfxRoVp/Oa5f3RzOzyfYkn7f1wXPnpTp/3VZoXWikszUBcgnpWFxzgOkkUaP2sGvSNf6r59qe/L9/6PpQdh/Z6gY58mkgYPno1j8JT3q/GC74z9VSFRakNc3tLOZZ80SKJXRNM9q8yLgzD0z6J5PbV68Z3d+FufsFmZrL0x45M5pt+XYo57s8kHOD82XJWmNFz7W6mABFrDQJRsivZf05zkcqP3k5OvXp58+/dNypPuMDA9p4ezvtjYHdQ0N6T0+Pcq7C+MCT7sG+c6srhkc+HCm3fC8y7vJypWZAkHnsBDdf4eVUUSRR5c6ge09g/L6177r3faCkcSBMc5qUpds294Sz/jvDheBib4Ygy0WGppEmrVoUK3Ngl547HCIlFMAtfpH2Z3O5YOnzG1Yv/a75x30zzer+AVHTbfPLtmz5QCQf/HIkH3yLNlUBDCnNA6u5HkU3g7RWhxUrAgluCyDlTe3KtFSv3dx14U9NBpje1AFf+p5IiAT6kUySWrl2w00tpbYvB/cQlJSKBBrVxLYNtn+2kH1SZPCCiL7bu+vXQ2vG3sd0tWEeKbIP8DzBIn4OaLCP5JufGWrrnAx9LpL2/m04FyBkS1IJkCBz3x85bJmwGMeCQQpMCpIDHr0YqSETKDyUCWc/uWNR7x8SCRZPnzNI+5V2HDjjZk0W+G7Pqk0r/jI87bk9UgkHMF1QTMRk3W5cX2GAueptjNecQQMuXa+260h7sg+l2/KfHTt/xZOA5an17edqaqs0GwB61m67syUV+pw3Q0opCQES5GirntuyJQ7MgjRVbCdtOpL91+G256/GuX1VJBJirjpHm5yaZ+nmze+PZH3fjpWjC7Q9JShiRVbp+cw9Eg0GMjMgBYRuzPdj2jP9WDZa/szWxV1DM59/IHRIeLxTnZz/6Lo3taQjX4yWwn8eSOuQhWI9fDB7bH5GOLw56zJ4JoZCyKflQmWjECze+WzbxNdfPfey6bm2ztpkD/Ds0fvmnZQ/9eutldY/o9cykokFgajhOcK6S6AxSmZWggVKp7jF7sDuz2xavfwbzEwWkDynpDtt/XmjD795Xr7zC6Gi/8OeFENVqiY43RhmPeHq3NDCzFKQ0Lg1gJQnVczFKje8Mv/JH7x0+kfKiQSLpOVdHwwPDj2RMsOh6Nq69aLItPeGaCX6LleqBqNWlhAkBFM9AuI6/kP1wZFkJSCEavMh48m8mo4U/3rTyq5fAmYp9varFxkzPce3bXzk1IX51rWthdYz1FSuRoDLRs5tNWVffAEBqyaEJQldK3YCk97Jz21cs+KuRWNjru2LGs9vokRCxM/pJ1v6e9aNfSKU838lUolEeSorlVDmud0OKXNOpgWbKaEIFPKLvDdfzEWr/5KL5e7edv7qZ4F9luztlw6dcY4B1tUngO7hrZ8OpX3XhY3waUiVwKwkBGlkx6HWHJnbaK1OMIOZpeb2aJUoIe8r/vPuttxtOxYt/wNgnXoOYNiu8i123BXIuk5XhaJBpOnCGrpTRdWBXgEws6GF/HoqkJ2ejE7/0daVPSN7VU3MFB80T0sAgGVbNy5vm4zdFij6VotsDWwYBgTp9lDqDGtSkQwwpPC4tUoIyPiz66ZbSx/fvnjFM/Z4hnvm2FJ1EHT4jLMoPjCgDcTjioi4c9eDgbc/0XFrqOD7RKDk9ap8yWDBGhzl0k7jTbCkQjETC6W1RrQsT6XyrbUf/OG0zG0vnd6bBoCV67d+sDUb/s/QlMuWaM3OFjizxbZ2ZMDccBHya+lY8ald0d0ffrRrzfa9Mc35+/OeXv/mzteinwumXR8O1QJuI5+XSpj3FDtDDGcajC30hYgEx3yUDRZfygWKX1i/avGP68/fy56Bg6UjxjibnINfsmX92bFU+LtRo2W1Nl4ESyWhkQbVaNm5autzL5UkXde4LYiUNvFyLlj+e1GjC9ry0Q96p6FYGiDSxMy9d02OgQkC1Kg95Jr2TP32yXOffe+rC/tKc95m5dAaZ4wNRE4pnHlHOOP5UKQS8al0AQxVBx3qGW6H7QQABVaaJEY0oGUDeeSDpW8+3vnKLVNv+6McMxM5ajePBB1xxgGYpW5Wbdh6fTDr+XK0GHXTdEEygQhW0acdvMPBODOoZzAked16NaZB1BjadNlERh0GxeH11wekTKfEQGdEH/fteeSRNw+9Bws/W5plU2bY6eUbRv8qnPffGC1HTheTRTBLCSJBIDKLg5qzFw2pVlJ4PVq5VUPWnx/IuDL/tHXlyoeAw7Nj+6KjwziLEsyiH+Y22EVj694eyYZujtRicf8kAfmyoQRr1qUcAObOxTFYEZMiBimdBRgkLPvoqOFxfMBUt9UOlzYdyvzsf8LbPrRr8TVFZwgBzFCLzwyf3vlK+JuRSvS9nmkFLlcNpbFGbN8YYiWXmZql2opLVWcQaU/qf7LR4o2bukzHygnrHdlZNemoMs4m5yR1jY6+L5TzXB8tR5e5JmtAtWbV5Dfgd/tKsHpSU7BZc+HIbTUBxWYhHRSYBTSjusDr2uPbfdOGnq6vMticOnsCmUV80AyiW//nF6Fz95x0Wyjr/XCkGA5ypihZsKUN7L44+mP/zIo1KRSHPVo2Uq7lgqXvv3LSczc9f2Zf5mCC6MOhY8I4AECCBfeb0gcCVg6P3hTKeT8VKUc6RaoEKJYQpDXirxnbvmxbyDP0Yj26YJDuQnmhB7vFa1/c1LPsK91DrA/31IFoig9ww1vcuPkjkXzwxmg58iYxUTS9X9uOodGmkxQxC0USHk2vtGpIe9Kj2bbSx7ZdsPIxoBkKO9p07BhnUZxZGyAoAvFbn364dcF4y5cCOf/V4aJP43RRsgaCteKb3GybOTM8SNj20KWhEDVemY5k+zf0LvuhNYkKMA97+Wlfn2QA79wysqi1HEuGct53+9IEVaoaLFgTqJ8+aD7aGbgDIMkSbl1TMS9SvvREPpS/ceOy5f88M9txrObxmDPOJqf6fOf2kUUtk/6bY0bbVZ6JGmS1arAGXTDNaffqgLZtexSkbPWKXW1T3/t95Onr95z/5wUbsO6YmDC3OPEPvWuGz7sumAvcHCr5A5zOm9giC1G/NGkOCWdWSjARRQOUdWUmc63Gd6bDE999/PxLxwGmBFv5xWNMx41xAGZ5n6tHRv9PMOfvjxotb+I9GQagIEizQOH6ZNbhM1viTGlUKuYRmWBxSzaa/fzmpSvW280s27hlTUs69O1wOXA2MmXAUBIaNJtLMzMbXOciDM3n00shAzlf4fs7503e8uR5F+0Bjp63eKB0fBlnkRMPfPMz97adPH7Ktf4p8cVINUoqWzRYsCBuOAx2DYVywExm8CtZ+P1UCFaR9WZ/yVAbNUNfEa4Er/IV3eCClcW3a0IIsDfeN8eRLEFCqA4fZX25HelAPmnDcEcC9TgSdEIwzqam3N/m9UtbsoFbIqrtCs+EBFcqhhKsC7uYlhoxYB2Vt04EIiYS4QCxWwOqEipXAABTM8KB2AN1TxEWtkgKJGJBSnvSyIaKXxnpuSsBGpQHnXY6ynRCMQ7ArKB41YbRvwgWfJ+OlKLvEBMFNn1xG+pylAw67KHJHJb1lwLm6QhoqMZmjJEZElL43HoxbCATLN6bCxW/tm3pys3A8VeLc9GJxziLnME7+GrX6uGPJoN5/42xYhicLhhM0GBfqWl9phnVaCQDnSLiLF9QxBASkoSmyc4Apv2pF3OBwvWbu7p+CtQ1gL0ATig6YRlnU1Pwvmn9Cn8peHNLtfVSz54quFIzWJAGR6Lf6bw01zQ6AnYCGEoREygaEGlPOpdvld8bN/Z845nuy3fFB1g7Ow4+Ht7igdIJzziLmkonVm7ccnUg5/9Ca7X1VBrPQykpbe8TsDaCWDSrQAjMJKEo4NEKoRpy4dID6VDxM3bK5URUi3PR64VxAMxJPfupOCeTpC7Y/tCCaLnzs/5JujpSiQRVtqCYGALmTlKhGnEeYMFmBiR0oak2H1Lu6SezHbW/3vLOJcPAieMtHii9rhhnk1N9vv3xkTPmjYduDZfDf+ZJM1S5IgkQxFa5LwGwvEXEApTxZkuZYOGmDWdu/B4WfraUYBbJ/v6DLh043vS6ZByA2SmZLWO9oZT+zXA1fJ4+XQMMCRCZqtHnplJYIhcq/ygdnExuX/yu54DXj1qci16/jLPJkQTt3PVvgbc+e/bHfRX3Z1wF6kRNMXuFqHhr20oRTmxYam6aeL2pxbno/wOTrUGMjBn/EgAAAABJRU5ErkJggg==";

const fmtTL = (n) => isNaN(n)||n===null ? "—" : new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",minimumFractionDigits:2}).format(n);

const DEFAULT_SETTINGS = {
  stopajTL_0_180:17.5, stopajTL_181_365:15, stopajTL_365plus:10, stopajYP_tum:25,
  bireyselKKDF:15, bireyselBSMV:15, ticariKKDF:0, ticariBSMV:5,
  zkTL_vadesiz:17, zkTL_6ay:10, zkYP_vadesiz:30, zkYP_diger:26,
  fonlamaMaliyeti:24.0,
  referansOran:3.11,
  bkmTakas:3.36,
  cariKarPayiOran:35.0,
  katilimKarPayiOran:2.0,
  // SÖİK (Sevk Öncesi İhracatın Finansmanı) - vadeye göre oranlar
  soikOran_180_1tks:39, soikOran_360_4tks:37, soikOran_540_6tks:37, soikOran_720_8tks:37,
  // Reeskont Kredisi
  reeskontOran_90:19.32, reeskontOran_180:19.82, reeskontOran_360:20.32, reeskontOran_720:20.32,
};

const C = {
  bg:"#0F1923", card:"#16222E",
  blue:"#5B9BD8", blueLight:"rgba(91,155,216,0.15)",
  green:"#4ADE80", greenLight:"rgba(74,222,128,0.15)",
  orange:"#E0A53D", orangeLight:"rgba(224,165,61,0.15)",
  purple:"#A78BFA", purpleLight:"rgba(167,139,250,0.15)",
  red:"#F87171", pink:"#F472B6", pinkLight:"rgba(244,114,182,0.15)",
  teal:"#5EEAD4", tealLight:"rgba(94,234,212,0.15)",
  label:"#F1F5F9", text:"#F1F5F9", sub:"rgba(255,255,255,0.55)", sub2:"rgba(255,255,255,0.38)", border:"rgba(255,255,255,0.12)", sep:"rgba(255,255,255,0.3)",
};

function Card({children,style}){return <div style={{background:C.card,borderRadius:16,padding:"14px 16px",marginBottom:10,border:`1px solid ${C.border}`,...style}}>{children}</div>;}
function SecTitle({children}){return <p style={{fontSize:12,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10,marginTop:2}}>{children}</p>;}

function formatWithDots(val){
  // val is a string possibly with dots already
  const clean = val.replace(/\./g,'').replace(/[^0-9,]/g,'');
  const parts = clean.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return parts.join(',');
}

function parseVal(val){
  // remove dots (thousands sep), keep comma as decimal
  if(!val) return '';
  return val.replace(/\./g,'').replace(',','.');
}

function TutarField({label,value,onChange,suffix,hint}){
  const [display,setDisplay] = useState(value?formatWithDots(String(value)):'');
  const handleChange = (e)=>{
    const raw = e.target.value;
    // Allow only digits, dots (sep), comma (decimal)
    const cleaned = raw.replace(/[^0-9,]/g,'');
    const formatted = formatWithDots(cleaned);
    setDisplay(formatted);
    // send raw numeric string to parent
    onChange(parseVal(formatted));
  };
  // sync if value cleared externally
  useEffect(()=>{ if(!value) setDisplay(''); },[value]);
  return(
    <div style={{marginBottom:13}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>{label}</label>
      <div style={{position:"relative"}}>
        <input inputMode="decimal" value={display} onChange={handleChange}
          style={{width:"100%",boxSizing:"border-box",padding:suffix?"11px 40px 11px 13px":"11px 13px",
            fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",
            border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
        {suffix&&<span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>{suffix}</span>}
      </div>
      {hint&&<p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>{hint}</p>}
    </div>
  );
}

function Field({label,value,onChange,suffix,hint,type="number",prefix}){
  // For ₺ fields use TutarField
  if(suffix==="₺" || suffix==="$" || suffix==="€"){
    return <TutarField label={label} value={value} onChange={onChange} suffix={suffix} hint={hint}/>;
  }
  const padLeft = prefix ? "11px 40px 11px 32px" : suffix ? "11px 40px 11px 13px" : "11px 13px";
  return(
    <div style={{marginBottom:13}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>{label}</label>
      <div style={{position:"relative"}}>
        {prefix&&<span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:14,zIndex:1}}>{prefix}</span>}
        <input type={type} inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)}
          style={{width:"100%",boxSizing:"border-box",padding:padLeft,
            fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",
            border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
        {suffix&&<span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>{suffix}</span>}
      </div>
      {hint&&<p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>{hint}</p>}
    </div>
  );
}

function Seg({options,value,onChange}){
  return(
    <div style={{display:"flex",background:"rgba(255,255,255,0.08)",borderRadius:9,padding:2,marginBottom:14}}>
      {options.map(o=>(
        <button key={o.v} onClick={()=>onChange(o.v)} style={{
          flex:1,padding:"7px 2px",borderRadius:7,border:"none",cursor:"pointer",
          background:value===o.v?C.card:"transparent",
          color:value===o.v?C.label:C.sub,
          fontWeight:value===o.v?700:500,fontSize:12,
          boxShadow:value===o.v?"0 1px 3px rgba(0,0,0,0.12)":"none",transition:"all 0.15s",
        }}>{o.l}</button>
      ))}
    </div>
  );
}

function RRow({label,value,accent,sub,big}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:sub?"7px 0":"10px 0",borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontSize:sub?12:14,color:sub?C.sub:C.label}}>{label}</span>
      <span style={{fontSize:big?19:sub?13:15,fontWeight:big?800:700,fontFamily:"monospace",color:accent||C.label}}>{value}</span>
    </div>
  );
}

// ─── FON GETİRİ İZLEME VE HESAPLAMA ────────────────────────────────────────────


// ─── Tema: Uygulamayla aynı koyu ton ─────────────────────────────────────────
const FC = {
  bg:      "#0F1923",
  card:    "#16222E",
  cardAlt: "#1C2B3A",
  blue:    "#5B9BD8",
  green:   "#4ADE80",
  greenL:  "rgba(74,222,128,0.15)",
  red:     "#F87171",
  redL:    "rgba(248,113,113,0.15)",
  orange:  "#E0A53D",
  orangeL: "rgba(224,165,61,0.15)",
  border:  "rgba(255,255,255,0.12)",
  text:    "#F1F5F9",
  sub:     "rgba(255,255,255,0.55)",
  sub2:    "rgba(255,255,255,0.35)",
};

// ─── Canlı veri ─────────────────────────────────────────────────────────────────
// Vakıf Katılım öncelikli sıralama için oncelik değeri API'den sonra atanır
const VAKIF_KODLARI = ["VLT","VHS","VKK","VKV","VPA"];

const PERIODS = [
  { key:"gunluk",   label:"Günlük"   },
  { key:"haftalik", label:"Haftalık" },
  { key:"aylik",    label:"Aylık"    },
  { key:"uc_aylik", label:"3 Aylık"  },
  { key:"ytd",      label:"YTD"      },
  { key:"yillik",   label:"1 Yıllık" },
];

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function tutarFormat(v) {
  const raw = v.replace(/[^0-9,]/g,"");
  const [int,...rest] = raw.split(",");
  const fmtInt = int.replace(/\B(?=(\d{3})+(?!\d))/g,".");
  return rest.length ? fmtInt+","+rest.join("") : fmtInt;
}
function tutarParse(s) { return parseFloat(s.replace(/\./g,"").replace(",","."))||0; }
function fmt(n,d=2) { return n.toLocaleString("tr-TR",{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtPct(v) { if(v==null)return"—"; return(v>=0?"+":"")+v.toFixed(2)+"%"; }
// Yıllık basit getiri — BIST takas yılı 252 iş günü
// Proxy'den gelen gunlukNorm: tatil/hafta sonu düzeltmesi yapılmış günlük oran
// Formül: (günlük_getiri / takas_araligi) × 252
function yillikBasit(gunlukPct: number | null, gunlukNorm?: number | null): number | null {
  if(!gunlukPct || gunlukPct === 0) return null;
  const normGunluk = gunlukNorm ?? gunlukPct;
  return normGunluk * 252;
}
function pctCol(v) { if(!v&&v!==0)return FC.sub2; return v>0?FC.green:v<0?FC.red:FC.sub2; }
function fmtPF(v) {
  if(!v)return"—";
  if(v>=1e9)return(v/1e9).toFixed(2)+" Mr ₺";
  if(v>=1e6)return(v/1e6).toFixed(0)+" Mn ₺";
  return"—";
}
function kisaYon(y) { 
  return y
    .replace("Vakıf Katılım Portföy Yönetimi A.Ş.", "Vakıf Katılım")
    .replace(" Portföy Yönetimi A.Ş.", "")
    .replace(" Yönetimi A.Ş.", "")
    .replace(" Portföy", "")
    .replace(" A.Ş.", "")
    .replace(" Emeklilik", "");
}

// Ayarlardan stopaj oku — prop yoksa localStorage fallback
function stopajOranSec(vade, settings) {
  const s0 = settings?.stopajTL_0_180  ?? 17.5;
  const s1 = settings?.stopajTL_181_365 ?? 15;
  const s2 = settings?.stopajTL_365plus ?? 10;
  if (vade <= 180) return s0;
  if (vade <= 365) return s1;
  return s2;
}

// ─── Getiri Hesaplayıcı ───────────────────────────────────────────────────────
function GetiriHesaplayici({ fon, settings, onKapat }) {
  // gunlukNorm: takas günü düzeltmeli gerçek günlük oran
  // takasAraligi: kaç günlük birikimi yansıtıyor (1=normal, 3=hafta sonu)
  const normOran = fon.gunlukNorm && fon.gunlukNorm !== 0 ? fon.gunlukNorm : fon.gunluk;
  const takasAraligi = fon.takasAraligi || 1;

  const [tutarStr, setTutarStr] = useState("");
  const [vade,     setVade]     = useState(String(takasAraligi));
  const [oran,     setOran]     = useState(String(Math.abs(normOran).toFixed(4)));
  const [tuzel,    setTuzel]    = useState(false);

  const sonuc = useMemo(() => {
    const T = tutarParse(tutarStr);
    const V = parseInt(vade)||0;
    const R = parseFloat(oran.replace(",","."))||0;
    if(T<=0||V<=0||R<=0) return null;
    const r = R/100;
    const brutGetiri = V===1 ? T*r : T*(Math.pow(1+r,V)-1);
    const sOran  = tuzel ? 0 : stopajOranSec(V, settings);
    const stopajTL   = brutGetiri*(sOran/100);
    const netGetiri  = brutGetiri-stopajTL;
    const netTutar   = T+netGetiri;
    const brutYillik = (Math.pow(1+r,365)-1)*100;
    const netYillik  = brutYillik*(1-sOran/100);
    return {T,V,R,brutGetiri,sOran,stopajTL,netGetiri,netTutar,brutYillik,netYillik};
  },[tutarStr,vade,oran,tuzel,settings]);

  const vadeBracket = sonuc
    ? (tuzel ? "Tüzel — Stopaj Yok"
      : `Bireysel — %${sonuc.sOran.toFixed(1)} Stopaj (${sonuc.V}g)`)
    : "";

  return (
    <div style={hs.wrap}>
      {/* Başlık */}
      <div style={hs.header}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={hs.fonBadge}>{fon.kod}</div>
          <span style={hs.title}>Getiri Hesaplayıcı</span>
        </div>
        <button onClick={onKapat} style={hs.kapat}>✕</button>
      </div>
      <div style={hs.fonAd}>{fon.ad}</div>

      {/* Bireysel / Tüzel */}
      <div style={hs.toggleRow}>
        <div style={hs.toggleGroup}>
          <button onClick={()=>setTuzel(false)}
            style={{...hs.tBtn,...(!tuzel?hs.tBtnAktif:{})}}>Bireysel</button>
          <button onClick={()=>setTuzel(true)}
            style={{...hs.tBtn,...(tuzel?hs.tBtnTuzel:{})}}>Tüzel</button>
        </div>
        {sonuc && <span style={hs.badge}>{vadeBracket}</span>}
      </div>

      {/* Giriş */}
      <div style={hs.grid3}>
        {[
          { lbl:"Fon Tutarı",     val:tutarStr, suf:"₺",    ph:"0",      set:v=>setTutarStr(tutarFormat(v)), mode:"decimal"  },
          { lbl:"Vade (Gün)",     val:vade,     suf:"gün",  ph:"30",     set:v=>setVade(v.replace(/\D/g,"")), mode:"numeric" },
          { lbl:"Günlük Oran",    val:oran,     suf:"%/gün",ph:"0.0000", set:setOran,                          mode:"decimal" },
        ].map(f=>(
          <div key={f.lbl} style={hs.grp}>
            <label style={hs.lbl}>{f.lbl}</label>
            <div style={hs.iWrap}>
              <input style={hs.inp} placeholder={f.ph} value={f.val}
                onChange={e=>f.set(e.target.value)} inputMode={f.mode}/>
              <span style={hs.suf}>{f.suf}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hesaplama notu */}
      <div style={hs.nota}>
        {takasAraligi > 1 && <span style={{color:"#f59e0b"}}>⚠️ {takasAraligi} günlük birikim — normalize edildi · </span>}
        {sonuc&&sonuc.V>1 ? `Bileşik hesaplama · (1 + %${sonuc.R.toFixed(4)})^${sonuc.V}`
          : sonuc&&sonuc.V===1 ? "Basit hesaplama · 1 günlük getiri"
          : "Tutar, vade ve oran giriniz"}
      </div>

      {sonuc && (
        <>
          <div style={hs.divider}/>

          {/* Sonuç kartları */}
          <div style={hs.grid3}>
            <div style={hs.kart}>
              <div style={hs.kLbl}>Brüt Getiri</div>
              <div style={{...hs.kVal,color:FC.green}}>+{fmt(sonuc.brutGetiri)} ₺</div>
              <div style={hs.kAlt}>%{fmt(sonuc.brutYillik)} yıllık</div>
            </div>
            <div style={{...hs.kart,opacity:tuzel?0.45:1}}>
              <div style={hs.kLbl}>Stopaj Kesintisi</div>
              <div style={{...hs.kVal,color:FC.red}}>
                {tuzel?"—":`-${fmt(sonuc.stopajTL)} ₺`}
              </div>
              <div style={hs.kAlt}>
                {tuzel?"Tüzel müşteri":`%${sonuc.sOran.toFixed(1)} oran`}
              </div>
            </div>
            <div style={{...hs.kart,background:FC.greenL,border:`1.5px solid ${FC.green}22`}}>
              <div style={hs.kLbl}>Net Getiri</div>
              <div style={{...hs.kVal,color:FC.green,fontSize:17}}>+{fmt(sonuc.netGetiri)} ₺</div>
              <div style={hs.kAlt}>%{fmt(sonuc.netYillik)} yıllık</div>
            </div>
          </div>

          {/* Net tutar */}
          <div style={hs.netBox}>
            <span style={hs.netLbl}>Vade Sonu Net Tutar</span>
            <span style={hs.netVal}>{fmt(sonuc.netTutar)} ₺</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
// props: settings (uygulamanın global settings state'i — stopajTL_* alanları okunur)
function FonGetiriIzleme({ settings }) {
  // Eğer prop gelmezse localStorage'dan oku (standalone kullanım)
  const [localSettings, setLocalSettings] = useState(null);
  useEffect(()=>{
    if(!settings){
      try{
        const s=localStorage.getItem("vk_settings");
        if(s) setLocalSettings(JSON.parse(s));
      }catch{}
    }
  },[settings]);
  const effectiveSettings = settings ?? localSettings;

  const [aktifPeriod, setAktifPeriod] = useState("gunluk");
  const [arama,       setArama]       = useState("");
  const [filtreYon,   setFiltreYon]   = useState("Tümü");
  const [sirala,      setSirala]     = useState<string>("gunlukD");
  const [secilenFon,  setSecilenFon]  = useState(null);
  const [hesapFon,    setHesapFon]    = useState(null);
  const [fonlar,      setFonlar]      = useState([]);
  const [yukleniyor,  setYukleniyor]  = useState(true);
  const [hata,        setHata]        = useState(null);

  // ── Canlı veri çek ────────────────────────────────────────────────────────
  useEffect(()=>{
    const veriCek = async () => {
      setYukleniyor(true);
      setHata(null);
      try {
        const r = await fetch(`/api/tefas-proxy?t=${Date.now()}`);
        const text = await r.text();
        let json: any;
        try { json = JSON.parse(text); } catch { throw new Error("Veri okunamadı: " + text.slice(0,100)); }
        if(!json.success) throw new Error(json.error || "Veri alınamadı");
        const veriyle = (json.data || []).map((f:any) => ({
          ...f,
          oncelik: VAKIF_KODLARI.includes(f.kod) ? 1 : 2,
        }));
        setFonlar(veriyle);
      } catch(e) {
        setHata(e.message);
      } finally {
        setYukleniyor(false);
      }
    };
    veriCek();
  },[]);

  const YONETICILER = useMemo(()=>[...new Set(fonlar.map(f=>f.yonetici.trim()).filter(Boolean))].sort(),[fonlar]);

  const maxVal = useMemo(()=>Math.max(...fonlar.map(f=>Math.abs(f[aktifPeriod]??0)),1),[fonlar,aktifPeriod]);

  const siralanmis = useMemo(()=>{
    // D=azalan(büyükten küçüğe), D yok=artan
    const azalan = sirala?.endsWith("D");
    const key = sirala?.replace("D","") as string;
    const keyMap: Record<string,string> = {gunluk:"gunluk",aylik:"aylik",yillik:"yillik",portfoy:"portfoy",yatirimci:"yatirimci"};
    const field = keyMap[key] || "yillik";
    return [...(fonlar)].sort((a,b)=>{
      const av = (a as any)[field] ?? (azalan?-Infinity:Infinity);
      const bv = (b as any)[field] ?? (azalan?-Infinity:Infinity);
      return azalan ? bv-av : av-bv;
    });
  },[fonlar, sirala]);

  const filtreli = useMemo(()=>{
    const q=arama.toUpperCase().trim();
    return siralanmis
      .filter(f=>{
        const aOk=!q||f.ad.toUpperCase().includes(q)||f.kod.toUpperCase().includes(q)||f.yonetici.toUpperCase().includes(q);
        const kat = (f.kategori||"").toUpperCase();
        const ad  = (f.ad||"").toUpperCase();
        const yOk=filtreYon==="Tümü"||(
              filtreYon==="Hisse"    ? (kat.includes("HİSSE")    || ad.includes("HİSSE")):
              filtreYon==="Para"     ? (kat.includes("PARA")     || ad.includes("PARA")):
              filtreYon==="Borçlanma"? (kat.includes("BORÇ")     || ad.includes("BORÇ")):
              filtreYon==="Karma"    ? (kat.includes("DEĞİŞKEN") || kat.includes("KARMA") || ad.includes("DEĞİŞKEN") || ad.includes("DİNAMİK")):
              filtreYon==="Sepet"    ? (kat.includes("SEPET")    || ad.includes("SEPET")):
              filtreYon==="Altın"    ? (kat.includes("ALTIN")    || kat.includes("KIYMETLİ") || kat.includes("GÜMÜŞ") || ad.includes("ALTIN") || ad.includes("GÜMÜŞ") || ad.includes("KIYMETLİ")):
              filtreYon==="Endeks"   ? (kat.includes("ENDEKS")   || ad.includes("ENDEKS")):
              false
            );
        return aOk&&yOk;
      });
  },[arama,filtreYon,siralanmis]);

  const ort = useMemo(()=>{
    const v=filtreli.map(f=>f[aktifPeriod]).filter(x=>x!=null&&x!==0);
    return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
  },[filtreli,aktifPeriod]);

  const enIyi = useMemo(()=>
    [...fonlar]
      .filter(f=>filtreYon==="Tümü"||f.yonetici===filtreYon)
      .sort((a,b)=>(b[aktifPeriod]??-Infinity)-(a[aktifPeriod]??-Infinity))[0]
  ,[fonlar,aktifPeriod,filtreYon]);

  const periodLabel=PERIODS.find(p=>p.key===aktifPeriod)?.label;

  const handleFonTikla=useCallback((fon)=>{
    if(secilenFon?.kod===fon.kod){setSecilenFon(null);setHesapFon(null);}
    else{setSecilenFon(fon);setHesapFon(null);}
  },[secilenFon]);

  return (
    <div style={{background:FC.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif",color:FC.text,minHeight:"100%"}}>
      <style>{`@keyframes fi{from{opacity:0}to{opacity:1}}`}</style>

      {/* Uyarı banner */}
      <div style={{background:"#1a1f2e",borderBottom:`1px solid ${FC.border}`,padding:"6px 12px",display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:11,color:"#8b949e"}}>⚠️</span>
        <span style={{fontSize:10,color:"#8b949e",lineHeight:1.4}}>
          <strong style={{color:"#cdd9e5"}}>Yatırım tavsiyesi değildir.</strong> Tüm rakamlar TEFAS'ın halka açık verisinden üretilmiştir; kararların sorumluluğu size aittir.
        </span>
      </div>

      {/* Arama */}
      <div style={{padding:"10px 12px 6px",borderBottom:`1px solid ${FC.border}`}}>
        <div style={{display:"flex",alignItems:"center",background:FC.card,border:`1px solid ${FC.border}`,borderRadius:10,padding:"8px 12px",gap:8}}>
          <span style={{color:FC.sub,fontSize:14}}>🔍</span>
          <input style={{flex:1,background:"none",border:"none",outline:"none",color:FC.text,fontSize:13,fontFamily:"inherit"}}
            placeholder="Ara — kod, isim, yönetici…"
            value={arama} onChange={e=>setArama(e.target.value)}/>
          {arama&&<button style={{background:"none",border:"none",color:FC.sub,cursor:"pointer",fontSize:12}} onClick={()=>setArama("")}>✕</button>}
        </div>
        <div style={{marginTop:4,fontSize:10,color:FC.sub,textAlign:"right"}}>{filtreli.length} / {fonlar.length} fon · Sıralama: {periodLabel}</div>
      </div>

      {/* Fon türü filtre chips */}
      <div style={{display:"flex",gap:5,padding:"8px 12px",overflowX:"auto",borderBottom:`1px solid ${FC.border}`,flexShrink:0}}>
        {[
          {key:"Tümü",      label:"🌟 Tümü"},
          {key:"Hisse",     label:"📈 Hisse"},
          {key:"Para",      label:"💰 Para Piyasası"},
          {key:"Borçlanma", label:"📄 Borçlanma"},
          {key:"Karma",     label:"⚖️ Değişken/Karma"},
          {key:"Sepet",     label:"🧺 Fon Sepeti"},
          {key:"Altın",     label:"🥇 Altın"},
          {key:"Endeks",    label:"📊 Endeks"},
        ].map(c=>{
          const aktif = filtreYon===c.key;
          return (
            <button key={c.key} onClick={()=>setFiltreYon(c.key)} style={{
              padding:"5px 10px",borderRadius:16,border:"none",cursor:"pointer",
              fontFamily:"inherit",fontSize:11,fontWeight:aktif?700:500,whiteSpace:"nowrap",
              background:aktif?FC.green:"rgba(255,255,255,0.06)",
              color:aktif?"#fff":FC.sub,flexShrink:0,
            }}>{c.label}</button>
          );
        })}
      </div>

      {/* Dönem sekmeler */}
      <div style={{display:"flex",background:"rgba(255,255,255,0.04)",padding:"6px 12px",gap:4,overflowX:"auto",borderBottom:`1px solid ${FC.border}`}}>
        {PERIODS.map(p=>(
          <button key={p.key} onClick={()=>{setAktifPeriod(p.key);setSirala(p.key+"D");}} style={{
            padding:"4px 12px",borderRadius:6,border:"none",cursor:"pointer",fontFamily:"inherit",
            fontSize:11,fontWeight:aktifPeriod===p.key?700:400,whiteSpace:"nowrap",
            background:aktifPeriod===p.key?FC.green:"transparent",
            color:aktifPeriod===p.key?"#fff":FC.sub,flexShrink:0,
          }}>{p.label}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          <span style={{fontSize:9,color:FC.sub}}>ORT.</span>
          <span style={{fontSize:13,fontWeight:700,color:pctCol(ort)}}>{fmtPct(ort)}</span>
        </div>
      </div>

      {/* Tablo başlığı */}
      <div style={{display:"flex",alignItems:"center",padding:"6px 10px",background:"#0d1520",borderBottom:`1px solid ${FC.border}`,borderTop:`1px solid ${FC.border}`}}>
        <span style={{width:38,flexShrink:0,fontSize:9,fontWeight:700,color:FC.sub,letterSpacing:0.5}}>KOD</span>
        <span style={{flex:1,fontSize:9,fontWeight:700,color:FC.sub,letterSpacing:0.5,textAlign:"center"}}>FON ADI</span>
        <span style={{width:58,textAlign:"right",flexShrink:0,fontSize:9,fontWeight:700,color:FC.sub,letterSpacing:0.5}}>KATEGORİ</span>
        <span onClick={()=>setSirala((ss:string)=>ss===aktifPeriod?aktifPeriod+"D":aktifPeriod)}
          style={{width:56,textAlign:"right",flexShrink:0,fontSize:9,fontWeight:700,cursor:"pointer",color:FC.green,letterSpacing:0.5}}>
          {periodLabel}{sirala===aktifPeriod+"D"?"↑":"↓"}
        </span>
        <span onClick={()=>setSirala((ss:string)=>ss==="portfoy"?"portfoyD":"portfoy")}
          style={{width:60,textAlign:"right",flexShrink:0,fontSize:9,fontWeight:700,cursor:"pointer",
            color:sirala?.replace("D","")==="portfoy"?FC.green:FC.sub,letterSpacing:0.5}}>
          BÜYÜKLÜK{sirala==="portfoy"?"↓":sirala==="portfoyD"?"↑":""}
        </span>
      </div>

      {/* Liste */}
      <div>
        {yukleniyor ? (
          <div style={s.empty}>
            <div style={{fontSize:24,marginBottom:8}}>⟳</div>
            <div>TEFAS verileri yükleniyor…</div>
          </div>
        ) : hata ? (
          <div style={s.empty}>
            <div style={{fontSize:20,marginBottom:8,color:FC.red}}>⚠</div>
            <div style={{color:FC.red,marginBottom:8}}>{hata}</div>
            <button onClick={()=>window.location.reload()} style={{padding:"6px 16px",borderRadius:8,border:`1px solid ${FC.green}`,background:FC.greenL,color:FC.green,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Tekrar Dene</button>
          </div>
        ) : filtreli.length===0
          ? <div style={s.empty}>Sonuç bulunamadı.</div>
          : filtreli.map((fon,i)=>{
              const g  =fon[aktifPeriod];
              const barW=Math.round((Math.abs(g??0)/maxVal)*100);
              const sel=secilenFon?.kod===fon.kod;
              const vakif=fon.oncelik===1;
              return (
                <div key={fon.kod}>
                  {/* Fon satırı */}
                  <div onClick={()=>handleFonTikla(fon)} style={{
                    display:"flex",alignItems:"center",padding:"7px 8px",
                    borderBottom:`1px solid ${FC.border}`,cursor:"pointer",
                    background:sel?"rgba(46,160,67,0.08)":"transparent",
                  }}>
                    <div style={{width:38,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:1}}>
                      <span style={{fontSize:12,fontWeight:800,color:vakif?FC.green:FC.blue}}>
                        {fon.kod}{vakif&&<span style={{fontSize:8,color:FC.green,opacity:0.8}}>★</span>}
                      </span>

                    </div>
                    <div style={{flex:1,minWidth:0,paddingRight:2,textAlign:"left"}}>
                      <div style={{fontSize:11,fontWeight:800,color:FC.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.3}}>{fon.ad}</div>

                    </div>
                    <span style={{width:58,textAlign:"right",flexShrink:0,fontSize:8,color:FC.sub2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {(fon.kategori||"—").length>10?(fon.kategori||"").slice(0,10)+"…":(fon.kategori||"—")}
                    </span>
                    <span style={{width:56,textAlign:"right",flexShrink:0,fontSize:11,fontWeight:700,color:pctCol(g)}}>
                      {g==null?"—":(g>0?"+":"")+g.toFixed(aktifPeriod==="gunluk"?4:2)+"%"}
                    </span>
                    <span style={{width:60,textAlign:"right",flexShrink:0,fontSize:10,color:FC.sub}}>{fmtPF(fon.portfoy)}</span>
                  </div>

                  {/* Detay paneli */}
                  {sel&&(
                    <div style={s.detayWrap}>
                      {/* Tam fon adı */}
                      <div style={{background:"#1a2535",borderRadius:10,padding:"10px 12px",marginBottom:10,border:`1px solid ${FC.border}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                          <div style={{fontSize:11,color:FC.sub}}>Fon Adı</div>

                        </div>
                        <div style={{fontSize:13,fontWeight:800,color:"#FFFFFF",lineHeight:1.4}}>{fon.ad}</div>

                      </div>
                      {/* Dönem grid */}
                      <div style={s.donemGrid}>
                        {PERIODS.map(p=>(
                          <div key={p.key} style={{...s.donemH,
                            background:p.key===aktifPeriod?FC.greenL:FC.cardAlt,
                            border:`1px solid ${p.key===aktifPeriod?FC.green+"44":FC.border}`}}>
                            <div style={s.donemL}>{p.label}</div>
                            <div style={{...s.donemV,color:pctCol(fon[p.key])}}>{fmtPct(fon[p.key])}</div>
                          </div>
                        ))}
                      </div>

                      <div style={s.detayAlt}>
                        <span style={{fontSize:11,color:FC.sub}}>
                          Portföy: <strong style={{color:FC.text}}>{fmtPF(fon.portfoy)}</strong>
                        </span>
                        <button
                          onClick={e=>{e.stopPropagation();setHesapFon(hesapFon?.kod===fon.kod?null:fon);}}
                          style={s.hesapBtn}>
                          ∑ Getiri Hesapla
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>

      {/* Alt bilgi */}
      <div style={s.footer}>
        <span style={{color:FC.sub2}}>{filtreli.length} / {fonlar.length} fon</span>
        <span style={{color:FC.sub2,fontSize:10}}>🕗 Her gün 08:30'da güncellenir · Fonoloji · TEFAS</span>

      {/* Getiri Hesaplayıcı — Bottom Sheet Modal */}
      {hesapFon&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:800,display:"flex",alignItems:"flex-end"}}
          onClick={()=>setHesapFon(null)}>
          <div style={{background:FC.bg,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",overflowY:"auto",padding:"0 0 32px"}}
            onClick={e=>e.stopPropagation()}>
            {/* Tutamaç */}
            <div style={{display:"flex",justifyContent:"center",padding:"10px 0 0"}}>
              <div style={{width:40,height:4,borderRadius:2,background:FC.border}}/>
            </div>
            <GetiriHesaplayici
              fon={hesapFon}
              settings={effectiveSettings}
              onKapat={()=>setHesapFon(null)}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ─── Ana bileşen stilleri ─────────────────────────────────────────────────────
const s = {
  wrap:{background:FC.bg,borderRadius:16,padding:"16px 0 14px",maxWidth:760,margin:"0 auto",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif",color:FC.text},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  hL:{display:"flex",alignItems:"center",gap:10,paddingLeft:14},
  hIcon:{width:36,height:36,borderRadius:10,background:"rgba(74,222,128,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20},
  hTitle:{fontSize:15,fontWeight:700,color:FC.text,letterSpacing:-0.2},
  hSub:{fontSize:11,color:FC.sub,marginTop:2},
  hR:{textAlign:"right"},
  sLbl:{fontSize:10,color:FC.sub,textTransform:"uppercase",letterSpacing:0.5},
  sVal:{fontSize:20,fontWeight:700,fontVariantNumeric:"tabular-nums"},
  segWrap:{display:"flex",background:"rgba(255,255,255,0.08)",borderRadius:9,padding:2,marginBottom:10,gap:0},
  seg:{flex:1,padding:"6px 0",border:"none",background:"none",color:FC.sub,fontSize:11,fontWeight:500,cursor:"pointer",borderRadius:7,transition:"all 0.15s",fontFamily:"inherit"},
  segA:{background:FC.card,color:FC.green,fontWeight:700,boxShadow:"0 1px 4px rgba(0,0,0,0.1)"},
  filterRow:{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"},
  fBtn:{padding:"4px 9px",borderRadius:6,border:`1px solid ${FC.border}`,background:FC.card,color:FC.sub,fontSize:10,cursor:"pointer",fontFamily:"inherit"},
  fBtnA:{background:FC.greenL,borderColor:FC.green+"55",color:FC.green,fontWeight:600},
  enIyiKart:{display:"flex",justifyContent:"space-between",alignItems:"center",background:FC.card,border:`1.5px solid ${FC.green}33`,borderLeft:`4px solid ${FC.green}`,borderRadius:12,padding:"11px 14px",marginBottom:10,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  enIyiLbl:{fontSize:10,color:FC.sub,marginBottom:3},
  enIyiKod:{fontSize:14,fontWeight:800,color:FC.green,letterSpacing:0.5},
  enIyiAd:{fontSize:10,color:FC.sub,marginTop:1},
  enIyiPct:{fontSize:22,fontWeight:800,fontVariantNumeric:"tabular-nums",flexShrink:0,marginLeft:12},
  srch:{display:"flex",alignItems:"center",background:FC.card,border:`1.5px solid ${FC.border}`,borderRadius:10,padding:"8px 11px",marginBottom:10,gap:8,boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
  srchIn:{flex:1,background:"none",border:"none",outline:"none",color:FC.text,fontSize:13,fontFamily:"inherit"},
  clr:{background:"none",border:"none",color:FC.sub,cursor:"pointer",fontSize:12,padding:0,fontFamily:"inherit"},
  thRow:{display:"flex",alignItems:"center",padding:"5px 8px",fontSize:9,fontWeight:700,color:FC.sub,textTransform:"uppercase",letterSpacing:0.6,borderBottom:`1px solid ${FC.border}`,borderTop:`1px solid ${FC.border}`,background:FC.cardAlt,marginBottom:0,position:"sticky" as any,top:0,zIndex:10},
  empty:{textAlign:"center",padding:"40px 0",color:FC.sub,fontSize:13},
  satir:{display:"flex",alignItems:"center",padding:"9px 10px",cursor:"pointer",transition:"background 0.1s",borderLeft:"3px solid transparent"},
  fonL:{flex:1,display:"flex",alignItems:"flex-start",gap:8,minWidth:0},
  idx:{fontSize:10,color:FC.sub2,width:16,paddingTop:2,flexShrink:0,textAlign:"right"},
  fKod:{fontSize:12,fontWeight:700,letterSpacing:0.5},
  fYon:{fontSize:10,color:FC.sub2},
  fAd:{fontSize:11,color:FC.sub,display:"block",lineHeight:1.3,marginBottom:3},
  oranSatir:{display:"flex",alignItems:"center",gap:4,marginBottom:3,flexWrap:"wrap"},
  gunlukOran:{fontSize:10,color:FC.sub,fontVariantNumeric:"tabular-nums",fontFamily:"monospace"},
  oranAyrac:{fontSize:10,color:FC.sub2},
  yillikOran:{fontSize:10,fontWeight:600,fontVariantNumeric:"tabular-nums",fontFamily:"monospace"},
  barWrap:{height:2,background:FC.border,borderRadius:1,overflow:"hidden",maxWidth:180},
  bar:{height:"100%",borderRadius:1,opacity:0.45,transition:"width 0.35s ease"},
  gtr:{fontSize:14,fontWeight:700,fontVariantNumeric:"tabular-nums",display:"block"},
  pf:{width:88,textAlign:"right",fontSize:11,color:FC.sub},
  detayWrap:{background:"rgba(74,222,128,0.12)",borderRadius:"0 0 10px 10px",padding:"10px 10px 12px",marginBottom:2,animation:"fi 0.2s ease",borderLeft:`3px solid ${FC.green}`,borderTop:`1px solid ${FC.green}22`},
  donemGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginBottom:8},
  donemH:{borderRadius:8,padding:"7px 9px",transition:"all 0.15s"},
  donemL:{fontSize:9,color:FC.sub,textTransform:"uppercase",letterSpacing:0.5,marginBottom:2},
  donemV:{fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums"},
  detayAlt:{display:"flex",justifyContent:"space-between",alignItems:"center"},
  hesapBtn:{padding:"6px 12px",borderRadius:8,border:`1px solid ${FC.green}55`,background:FC.greenL,color:FC.green,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"},
  hesapBtnA:{background:FC.redL,borderColor:FC.red+"55",color:FC.red},
  footer:{marginTop:12,paddingTop:10,borderTop:`1px solid ${FC.border}`,display:"flex",justifyContent:"space-between",fontSize:10},
};

// ─── Hesaplayıcı stilleri ────────────────────────────────────────────────────
const hs = {
  wrap:{background:FC.card,borderRadius:12,padding:"14px",marginTop:10,animation:"fi 0.2s ease",border:`1px solid ${FC.border}`,boxShadow:"0 2px 8px rgba(0,0,0,0.07)"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3},
  fonBadge:{background:FC.greenL,color:FC.green,fontWeight:800,fontSize:13,letterSpacing:0.8,padding:"2px 8px",borderRadius:6,border:`1px solid ${FC.green}33`},
  title:{fontSize:13,fontWeight:600,color:FC.text},
  kapat:{background:"none",border:"none",color:FC.sub,cursor:"pointer",fontSize:14,fontFamily:"inherit"},
  fonAd:{fontSize:10,fontWeight:700,color:FC.text,marginBottom:10,lineHeight:1.4},
  toggleRow:{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"},
  toggleGroup:{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:8,padding:2,gap:0},
  tBtn:{padding:"5px 14px",border:"none",background:"none",color:FC.sub,fontSize:12,fontWeight:500,cursor:"pointer",borderRadius:6,fontFamily:"inherit"},
  tBtnAktif:{background:FC.cardAlt,color:FC.green,fontWeight:700,boxShadow:"0 1px 3px rgba(0,0,0,0.25)"},
  tBtnTuzel:{background:FC.cardAlt,color:FC.orange,fontWeight:700,boxShadow:"0 1px 3px rgba(0,0,0,0.25)"},
  badge:{fontSize:10,color:FC.sub,flexShrink:0},
  grid3:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:6},
  grp:{display:"flex",flexDirection:"column",gap:4},
  lbl:{fontSize:10,color:FC.sub,textTransform:"uppercase",letterSpacing:0.5,fontWeight:600},
  iWrap:{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${FC.border}`,borderRadius:8,padding:"7px 10px",gap:4},
  inp:{flex:1,background:"none",border:"none",outline:"none",color:FC.text,fontSize:13,fontFamily:"inherit",fontVariantNumeric:"tabular-nums",width:0},
  suf:{fontSize:10,color:FC.sub2,flexShrink:0},
  nota:{fontSize:10,color:FC.sub2,marginBottom:8,minHeight:14},
  divider:{height:1,background:FC.border,margin:"8px 0"},
  kart:{background:FC.cardAlt,borderRadius:10,padding:"10px",border:`1px solid ${FC.border}`},
  kLbl:{fontSize:9,color:FC.sub,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4,fontWeight:600},
  kVal:{fontSize:15,fontWeight:700,fontVariantNumeric:"tabular-nums",marginBottom:2},
  kAlt:{fontSize:9,color:FC.sub},
  netBox:{background:FC.greenL,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,border:`1px solid ${FC.green}33`},
  netLbl:{fontSize:11,color:FC.green,fontWeight:600},
  netVal:{fontSize:17,fontWeight:800,color:FC.green,fontVariantNumeric:"tabular-nums"},
};




// ─── HİSSE DETAY PANELİ ────────────────────────────────────────────────────
function HisseDetay({ hisse, onGeri }: { hisse: any, onGeri: () => void }) {
  const [grafik, setGrafik]       = useState<any[]>([]);
  const [grafikYukl, setGrafikYukl] = useState(true);
  const [donem, setDonem]         = useState<"1a"|"3a"|"1y">("1a");

  useEffect(() => {
    if (!hisse?.ticker) return;
    setGrafikYukl(true);
    // İş Yatırım geçmiş fiyat API
    const bugun = new Date();
    const pad = (n:number) => String(n).padStart(2,"0");
    const fmt = (d:Date) => `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()}`;
    const bitis = fmt(bugun);
    const baslangic = new Date(bugun);
    if (donem === "1a") baslangic.setMonth(bugun.getMonth() - 1);
    else if (donem === "3a") baslangic.setMonth(bugun.getMonth() - 3);
    else baslangic.setFullYear(bugun.getFullYear() - 1);
    const bas = fmt(baslangic);

    fetch(`/api/hisse-gecmis?ticker=${hisse.ticker}&baslangic=${bas}&bitis=${bitis}`)
      .then(r => r.json())
      .then(d => {
        const pts = (d.data || []).filter((p: any) => p.kapanis > 0);
        setGrafik(pts);
      })
      .catch(() => setGrafik([]))
      .finally(() => setGrafikYukl(false));
  }, [hisse?.ticker, donem]);

  const renk = hisse.degisim1g >= 0 ? C.green : C.red;
  const degStr = (v: number | null) => v != null ? (v > 0 ? "+" : "") + v.toFixed(2) + "%" : "—";

  // Mini SVG çizgi grafiği (Recharts olmadan)
  const [tooltip, setTooltip] = useState<{x:number,y:number,p:any}|null>(null);

  const SVGGrafik = () => {
    if (grafik.length < 2) return <div style={{height:160,display:"flex",alignItems:"center",justifyContent:"center",color:C.sub,fontSize:12}}>Veri yüklenemedi</div>;

    const w = 320, h = 130, pad = 4;
    const prices = grafik.map(p => p.kapanis);
    const min = Math.min(...prices) * 0.999;
    const max = Math.max(...prices) * 1.001;
    const scaleY = (v: number) => h - ((v - min) / (max - min)) * h;
    const stepX = (w - pad*2) / (grafik.length - 1 || 1);
    const cizgiRenk = (grafik[grafik.length-1]?.kapanis >= grafik[0]?.kapanis) ? "#4ade80" : "#f87171";

    const pathPuanlari = grafik.map((p, i) => `${pad + i * stepX},${scaleY(p.kapanis)}`).join(" L ");
    const linePath = `M ${pathPuanlari}`;
    const areaPath = `M ${pad},${h} L ${pathPuanlari} L ${pad + (grafik.length-1)*stepX},${h} Z`;

    return (
      <div style={{position:"relative"}}>
        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position:"absolute", top:0, left:0, right:0,
            background:"rgba(0,0,0,0.75)", borderRadius:6, padding:"4px 8px",
            fontSize:10, color:"#fff", display:"flex", gap:10, justifyContent:"center", zIndex:10,
          }}>
            <span style={{color:"#aaa"}}>{tooltip.p.tarih}</span>
            <span style={{fontWeight:700,color:"#4ade80"}}>K:{tooltip.p.kapanis?.toLocaleString("tr-TR")} ₺</span>
          </div>
        )}
        <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:160,overflow:"visible",cursor:"crosshair"}}
          onMouseLeave={()=>setTooltip(null)}
          onClick={(e)=>{
            const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
            const xRel = (e.clientX - rect.left) / rect.width * w;
            const idx = Math.min(grafik.length-1, Math.max(0, Math.round((xRel - pad) / stepX)));
            setTooltip({x:xRel, y:0, p:grafik[idx]});
          }}
          onTouchEnd={(e)=>{
            const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
            const touch = e.changedTouches[0];
            const xRel = (touch.clientX - rect.left) / rect.width * w;
            const idx = Math.min(grafik.length-1, Math.max(0, Math.round((xRel - pad) / stepX)));
            setTooltip({x:xRel, y:0, p:grafik[idx]});
          }}
        >
          {/* Yatay ızgara çizgileri */}
          {[0.25,0.5,0.75].map(r=>(
            <line key={r} x1={0} x2={w} y1={h*r} y2={h*r} stroke="#ffffff11" strokeWidth="1"/>
          ))}

          {/* Alan dolgusu */}
          <defs>
            <linearGradient id="alanGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cizgiRenk} stopOpacity="0.25"/>
              <stop offset="100%" stopColor={cizgiRenk} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#alanGradient)" stroke="none"/>

          {/* Çizgi */}
          <path d={linePath} fill="none" stroke={cizgiRenk} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>

          {/* Seçili nokta vurgusu */}
          {tooltip && (() => {
            const idx = grafik.findIndex(p => p.tarih === tooltip.p.tarih);
            if (idx < 0) return null;
            const x = pad + idx * stepX;
            const y = scaleY(grafik[idx].kapanis);
            return (
              <g>
                <line x1={x} x2={x} y1={0} y2={h} stroke="#ffffff33" strokeWidth="1" strokeDasharray="2,2"/>
                <circle cx={x} cy={y} r={3.5} fill={cizgiRenk} stroke="#fff" strokeWidth="1"/>
              </g>
            );
          })()}
        </svg>
      </div>
    );
  };

  return (
    <div style={{background:C.bg,minHeight:"100%",paddingBottom:80}}>
      {/* Header */}
      <div style={{background:C.card,padding:"12px 16px 16px",borderBottom:`1px solid ${C.border}`}}>
        <button onClick={onGeri} style={{background:"none",border:"none",color:C.blue,fontSize:14,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:8}}>‹ Geri</button>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:20,fontWeight:900,color:C.text}}>{hisse.ticker}</span>
              {hisse.katilimEndeksi && <span style={{fontSize:10,background:C.greenLight,color:C.green,borderRadius:4,padding:"2px 6px",fontWeight:700}}>KE</span>}
            </div>
            <div style={{fontSize:12,color:C.sub,marginTop:2}}>{hisse.sirket}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,fontWeight:800,color:C.text}}>{hisse.fiyat ? hisse.fiyat.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "—"} <span style={{fontSize:12,color:C.sub}}>₺</span></div>
            <div style={{fontSize:14,fontWeight:700,color:renk}}>{hisse.degisim1g > 0 ? "+" : ""}{hisse.degisim1g?.toFixed(2)}%</div>
          </div>
        </div>
      </div>

      {/* Grafik */}
      <div style={{background:C.card,margin:"10px 0",padding:"12px 16px"}}>
        {/* Dönem butonları */}
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {([["1a","1 Ay"],["3a","3 Ay"],["1y","1 Yıl"]] as ["1a"|"3a"|"1y",string][]).map(([k,l]) => (
            <button key={k} onClick={() => setDonem(k)} style={{
              padding:"4px 12px",borderRadius:6,border:`1px solid ${C.border}`,
              background:donem===k?C.blue:"none",color:donem===k?"#fff":C.sub,
              fontSize:11,fontWeight:donem===k?700:400,cursor:"pointer",fontFamily:"inherit"
            }}>{l}</button>
          ))}
        </div>
        {grafikYukl
          ? <div style={{height:120,display:"flex",alignItems:"center",justifyContent:"center",color:C.sub,fontSize:12}}>⟳ Yükleniyor…</div>
          : <SVGGrafik />
        }
        {grafik.length > 1 && (
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:C.sub}}>
            <span>{grafik[0]?.tarih}</span>
            <span>{grafik[grafik.length-1]?.tarih}</span>
          </div>
        )}
      </div>

      {/* Değişimler */}
      <div style={{margin:"0 0 10px",padding:"0 14px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[
            ["Günlük", hisse.degisim1g],
            ["Haftalık", hisse.degisim1h],
            ["Aylık", hisse.degisim1a],
            ["Yıllık", hisse.degisim1y],
          ].map(([lbl, val]: any) => (
            <div key={lbl} style={{background:C.card,borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
              <div style={{fontSize:10,color:C.sub,marginBottom:4}}>{lbl} Değişim</div>
              <div style={{fontSize:16,fontWeight:800,color:val > 0 ? C.green : val < 0 ? C.red : C.sub}}>
                {val != null ? (val > 0 ? "+" : "") + val.toFixed(2) + "%" : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Temel Veriler */}
      <div style={{padding:"0 14px"}}>
        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Temel Göstergeler</div>
        <div style={{background:C.card,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden"}}>
          {[
            ["Sektör", hisse.sektor ? (SEKTOR_TR[hisse.sektor] || hisse.sektor) : "—"],
            ["F/K Oranı", hisse.fk ? hisse.fk.toFixed(2) : "—"],
            ["PD/DD Oranı", hisse.pddd ? hisse.pddd.toFixed(2) : "—"],
            ["ROE (Özkaynak Getirisi)", hisse.roe ? hisse.roe.toFixed(2) + "%" : "—"],
            ["Temettü Verimi", hisse.temetu ? hisse.temetu.toFixed(2) + "%" : "—"],
            ["Gün İçi Yüksek", hisse.yuksek ? hisse.yuksek.toLocaleString("tr-TR") + " ₺" : "—"],
            ["Gün İçi Düşük", hisse.dusuk ? hisse.dusuk.toLocaleString("tr-TR") + " ₺" : "—"],
            ["Hacim", hisse.hacim ? hisse.hacim.toLocaleString("tr-TR") + " lot" : "—"],
            ["Katılım Endeksi", hisse.katilimEndeksi ? "✅ XK100'de" : "❌ XK100'de değil"],
          ].map(([lbl, val], i, arr) => (
            <div key={lbl as string} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}>
              <span style={{fontSize:13,color:C.sub}}>{lbl}</span>
              <span style={{fontSize:13,fontWeight:600,color:C.text}}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BIST HİSSE TARAYICI ─────────────────────────────────────────────────────

const SEKTOR_TR: Record<string, string> = {
  "Finance": "Finans",
  "Process Industries": "Kimya/Plastik",
  "Producer Manufacturing": "Üretim",
  "Consumer Non-Durables": "Tüketim Malları",
  "Non-Energy Minerals": "Madencilik/Metal",
  "Utilities": "Enerji/Elektrik",
  "Consumer Services": "Tüketici Hizm.",
  "Technology Services": "Teknoloji",
  "Distribution Services": "Dağıtım",
  "Consumer Durables": "Dayanıklı Tüketim",
  "Retail Trade": "Perakende",
  "Transportation": "Ulaştırma",
  "Industrial Services": "Endüstriyel",
  "Electronic Technology": "Elektronik",
  "Commercial Services": "Ticari Hizm.",
  "Health Technology": "Sağlık Tech.",
  "Miscellaneous": "Diğer",
  "Health Services": "Sağlık",
  "Energy Minerals": "Enerji",
  "Communications": "İletişim",
};

function fmt2(n: number | null | undefined, dec = 2): string {
  if (n == null || isNaN(Number(n))) return "—";
  return n.toFixed(dec);
}
function fmtByk(n: number): string {
  if (!n) return "—";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + " Tr ₺";
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + " Mr ₺";
  if (n >= 1e6)  return (n / 1e6).toFixed(0) + " Mn ₺";
  return n.toLocaleString("tr-TR") + " ₺";
}

function BistHisseTarayici() {
  const [hisseler, setHisseler]         = useState<any[]>([]);
  const [yukleniyor, setYukleniyor]     = useState(true);
  const [hata, setHata]                 = useState<string|null>(null);
  const [arama, setArama]               = useState("");
  const [sektor, setSektor]             = useState("Tümü");
  const [sadeceKatilim, setSadeceKatilim] = useState(false);
  const [siraBy, setSiraBy]             = useState<"degisim1g"|"degisim1h"|"degisim1a"|"degisim1y"|"fk"|"pddd"|"roe"|"temetu">("degisim1g");
  const [siraDir, setSiraDir]           = useState<1|-1>(-1); // Değişim için azalan başlasın
  const [secilen, setSecilen]           = useState<any>(null);
  const [detayHisse, setDetayHisse]     = useState<any>(null);
  const [yukDusAcik, setYukDusAcik]     = useState<"yuk"|"dus"|null>(null);

  const [sonGuncelleme, setSonGuncelleme] = useState<Date|null>(null);

  useEffect(() => {
    const fetchHisse = () => {
      fetch("/api/hisse-proxy")
        .then(r => r.json())
        .then(d => {
          if (d.success) { setHisseler(d.data); setSonGuncelleme(new Date()); }
          else setHata(d.error || "Veri alınamadı");
        })
        .catch(e => setHata(e.message))
        .finally(() => setYukleniyor(false));
    };

    fetchHisse();
    const interval = setInterval(fetchHisse, 5 * 60 * 1000); // 5 dakikada bir
    return () => clearInterval(interval);
  }, []);

  const sektorler = useMemo(() => {
    const set = new Set(hisseler.map(h => h.sektor).filter(Boolean));
    return ["Tümü", ...Array.from(set).sort()];
  }, [hisseler]);

  const filtreli = useMemo(() => {
    const q = arama.toUpperCase().trim();
    return hisseler
      .filter(h => {
        if (sadeceKatilim && !h.katilimEndeksi) return false;
        if (sektor !== "Tümü" && h.sektor !== sektor) return false;
        if (q && !h.ticker.includes(q) && !h.sirket.toUpperCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[siraBy] ?? (siraDir === 1 ? Infinity : -Infinity);
        const bv = b[siraBy] ?? (siraDir === 1 ? Infinity : -Infinity);
        return (av - bv) * siraDir;
      });
  }, [hisseler, arama, sektor, sadeceKatilim, siraBy, siraDir]);

  const siraToggle = (col: typeof siraBy) => {
    if (siraBy === col) setSiraDir(d => d === 1 ? -1 : 1);
    else { setSiraBy(col); setSiraDir(1); }
  };

  if (detayHisse) return <HisseDetay hisse={detayHisse} onGeri={() => setDetayHisse(null)} />;

  return (
    <div style={{background:C.bg, padding:"12px 14px 80px", minHeight:"100%"}}>
      {/* Başlık */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:C.blueLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📊</div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.text}}>BİST Hisse Veri İzleme</div>
            <div style={{fontSize:11,color:C.sub}}>
              {filtreli.length} hisse · ⚠️ 15 dk gecikmeli · 🔄 {sonGuncelleme ? sonGuncelleme.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}) : "—"}
            </div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,color:C.sub,textTransform:"uppercase",letterSpacing:0.5}}>Katılım</div>
          <div style={{fontSize:13,fontWeight:700,color:C.green}}>{hisseler.filter(h=>h.katilimEndeksi).length} / {hisseler.length}</div>
        </div>
      </div>

      {/* Katılım toggle */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <button
          onClick={() => setSadeceKatilim(k => !k)}
          style={{
            padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit",
            fontSize:12,fontWeight:600,
            background: sadeceKatilim ? C.green : C.greenLight,
            color: sadeceKatilim ? "#fff" : C.green,
          }}>
          {sadeceKatilim ? "✓ Katılım Endeksi (XK100)" : "Katılım Endeksi (XK100)"}
        </button>

        {/* Sektör */}
        <select
          value={sektor}
          onChange={e => setSektor(e.target.value)}
          style={{flex:1,background:C.card,border:`1.5px solid ${C.border}`,borderRadius:8,padding:"6px 10px",fontSize:11,color:C.text,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          {sektorler.map(s => (
            <option key={s} value={s}>
              {s === "Tümü" ? "Tüm Sektörler" : (SEKTOR_TR[s] || s)}
            </option>
          ))}
        </select>
      </div>

      {/* Arama */}
      <div style={{display:"flex",alignItems:"center",background:C.card,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"7px 10px",marginBottom:10,gap:8}}>
        <span style={{color:C.sub2,fontSize:15}}>🔍</span>
        <input
          style={{flex:1,background:"none",border:"none",outline:"none",color:C.text,fontSize:13,fontFamily:"inherit"}}
          placeholder="Ticker veya şirket adı ara…"
          value={arama}
          onChange={e => setArama(e.target.value)}
        />
        {arama && <button style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:12,fontFamily:"inherit"}} onClick={() => setArama("")}>✕</button>}
      </div>

      {/* Yükselenler / Düşenler Paneli */}
      {hisseler.length > 0 && (
        <div style={{marginBottom:10}}>
          {/* Toggle başlık */}
          <div style={{display:"flex",gap:6,marginBottom:yukDusAcik?6:0}}>
            {(["yuk","dus"] as const).map(tip => (
              <button key={tip} onClick={()=>setYukDusAcik(v=>v===tip?null:tip)}
                style={{
                  flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,
                  padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,
                  background:yukDusAcik===tip?(tip==="yuk"?"rgba(46,160,67,0.15)":"rgba(248,81,73,0.15)"):C.card,
                  color:yukDusAcik===tip?(tip==="yuk"?C.green:C.red):C.sub,
                  fontFamily:"inherit",fontSize:12,fontWeight:yukDusAcik===tip?700:500,cursor:"pointer",
                }}>
                <span>{tip==="yuk"?"📈":"📉"}</span>
                <span>{tip==="yuk"?"En Çok Yükselenler":"En Çok Düşenler"}</span>
                <span style={{fontSize:10,opacity:0.7}}>{yukDusAcik===tip?"▲":"▼"}</span>
              </button>
            ))}
          </div>

          {/* Panel içeriği */}
          {yukDusAcik && (() => {
            const liste = [...hisseler]
              .filter(h => h.degisim1g != null)
              .sort((a,b) => yukDusAcik==="yuk" ? b.degisim1g-a.degisim1g : a.degisim1g-b.degisim1g)
              .slice(0,10);
            return (
              <div style={{background:C.card,borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                {liste.map((h,i)=>(
                  <div key={h.ticker} onClick={()=>setDetayHisse(h)}
                    style={{display:"flex",alignItems:"center",padding:"8px 12px",
                      borderBottom:i<9?`1px solid ${C.border}`:"none",cursor:"pointer",
                      background:i%2===0?"transparent":"rgba(255,255,255,0.02)"}}>
                    <span style={{width:22,fontSize:11,color:C.sub2,flexShrink:0}}>{i+1}</span>
                    <span style={{flex:1,fontSize:12,fontWeight:700,color:yukDusAcik==="yuk"?C.green:C.red,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.sirket||h.ticker}</span>
                    <span style={{fontSize:13,fontWeight:700,color:yukDusAcik==="yuk"?C.green:C.red,flexShrink:0}}>
                      {h.degisim1g>0?"+":""}{h.degisim1g?.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Sıralama butonları */}
      <div style={{display:"flex",gap:4,marginBottom:10,overflowX:"auto"}}>
        {([["degisim1g","Gün%"],["degisim1h","Haf%"],["degisim1a","Ay%"],["degisim1y","Yıl%"],["fk","F/K"],["pddd","PD/DD"],["roe","ROE"],["temetu","Tmt%"]] as [typeof siraBy, string][]).map(([col, lbl]) => (
          <button key={col} onClick={() => siraToggle(col)}
            style={{
              padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,
              background: siraBy===col ? C.blueLight : C.card,
              color: siraBy===col ? C.blue : C.sub,
              fontSize:11,fontWeight:siraBy===col?700:400,
              cursor:"pointer",fontFamily:"inherit",flexShrink:0,whiteSpace:"nowrap",
            }}>
            {lbl} {siraBy===col ? (siraDir===1?"↑":"↓") : ""}
          </button>
        ))}
      </div>

      {/* İçerik */}
      {yukleniyor ? (
        <div style={{textAlign:"center",padding:"40px 0",color:C.sub}}>⟳ Veriler yükleniyor…</div>
      ) : hata ? (
        <div style={{textAlign:"center",padding:"40px 0",color:C.red}}>{hata}</div>
      ) : filtreli.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 0",color:C.sub}}>Sonuç bulunamadı.</div>
      ) : (
        <div>
          {filtreli.map((h, i) => (
            <div key={h.ticker}>
              <div
                onClick={() => setDetayHisse(h)}
                style={{
                  display:"flex",alignItems:"center",gap:10,
                  padding:"10px 12px",
                  background: secilen?.ticker===h.ticker ? C.blueLight : C.card,
                  borderLeft: secilen?.ticker===h.ticker ? `3px solid ${C.blue}` :
                               h.katilimEndeksi ? `3px solid ${C.green}66` : `3px solid transparent`,
                  cursor:"pointer",borderRadius:10,marginBottom:6,
                  border:`1px solid ${C.border}`,
                }}>
                {/* Ticker + Şirket adı */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <span style={{fontSize:13,fontWeight:800,color:h.katilimEndeksi?C.green:C.blue,flexShrink:0}}>{h.ticker}</span>
                    {h.katilimEndeksi && <span style={{fontSize:10,color:C.green}}>☪</span>}
                  </div>
                  {h.sirket&&h.sirket.toUpperCase()!==h.ticker.toUpperCase()&&(
                    <div style={{fontSize:11,color:C.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {h.sirket}
                    </div>
                  )}
                </div>

                {/* Fiyat + Günlük değişim */}
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text,fontVariantNumeric:"tabular-nums",marginBottom:2}}>
                    {h.fiyat ? h.fiyat.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "—"}
                  </div>
                  <div style={{
                    fontSize:11,fontWeight:700,
                    color:h.degisim1g>0?C.green:h.degisim1g<0?C.red:C.sub,
                  }}>
                    {h.degisim1g ? (h.degisim1g>0?"▲ +":h.degisim1g<0?"▼ ":"")+h.degisim1g.toFixed(2)+"%" : "—"}
                  </div>
                </div>
              </div>

              {/* Detay paneli */}
              {secilen?.ticker === h.ticker && (
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginBottom:6,animation:"fi 0.2s ease"}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:4}}>{h.sirket}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                    {[
                      ["Fiyat (₺)", h.fiyat ? h.fiyat.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "—"],
                      ["Günlük Değişim", h.degisim1g ? (h.degisim1g>0?"+":"")+h.degisim1g.toFixed(2)+"%" : "—"],
                      ["Haftalık Değişim", h.degisim1h ? (h.degisim1h>0?"+":"")+h.degisim1h.toFixed(2)+"%" : "—"],
                      ["Aylık Değişim", h.degisim1a ? (h.degisim1a>0?"+":"")+h.degisim1a.toFixed(2)+"%" : "—"],
                      ["Yıllık Değişim", h.degisim1y ? (h.degisim1y>0?"+":"")+h.degisim1y.toFixed(2)+"%" : "—"],
                      ["F/K (Fiyat/Kazanç)", fmt2(h.fk,2)],
                      ["PD/DD (Piyasa/Defter)", fmt2(h.pddd,2)],
                      ["ROE (Özkaynak Getirisi)", h.roe ? fmt2(h.roe,2)+"%" : "—"],
                      ["Temettü Verimi", h.temetu ? fmt2(h.temetu,2)+"%" : "—"],
                      ["Sektör", SEKTOR_TR[h.sektor] || h.sektor],
                      ["Katılım Endeksi", h.katilimEndeksi ? "✅ XK100" : "❌ Değil"],
                    ].map(([lbl, val]) => (
                      <div key={lbl as string} style={{background:C.bg,borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:C.sub,textTransform:"uppercase",letterSpacing:0.4,marginBottom:3}}>{lbl}</div>
                        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── KATILIM FONU ARAÇLARI ───────────────────────────────────────────────────

function VadeliKatilim({s,onGecmis}){
  const [tutar,setTutar]=useState("");
  const [gun,setGun]=useState("");
  const [oran,setOran]=useState("");
  const [doviz,setDoviz]=useState("TL");
  const [kaydedildi,setKaydedildi]=useState(false);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),G=parseInt(gun),rt=parseFloat(oran);
    if(!T||!G||!rt)return null;
    const gunlukOran=rt/100/365;
    const bf=T*gunlukOran*G;
    const sOran=doviz==="TL"?(G<=180?s.stopajTL_0_180:G<=365?s.stopajTL_181_365:s.stopajTL_365plus):s.stopajYP_tum;
    const stop=bf*(sOran/100);
    const nf=bf-stop;
    const nv=T+nf;
    const ey=(nf/T)/G*365*100;
    return{bf,stop,nf,nv,ey,sOran};
  },[tutar,gun,oran,doviz,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"TL Katılım"},{v:"USD",l:"USD Katılım"},{v:"EUR",l:"EUR Katılım"}]} value={doviz} onChange={setDoviz}/>
        <Field label="Katılım Tutarı" value={tutar} onChange={setTutar} suffix={doviz==="TL"?"₺":doviz==="USD"?"$":"€"}/>
        <Field label="Vade (Gün)" value={gun} onChange={setGun} suffix="Gün" hint="Örn: 32 gün, 91 gün, 182 gün, 365 gün"/>
        <Field label="Kâr Payı Oranı (Yıllık)" value={oran} onChange={setOran} suffix="%"/>
      </Card>
      {r&&<Card>
        <SecTitle>Sonuçlar</SecTitle>
        <RRow label="Brüt Kâr Payı" value={fmtTL(r.bf)}/>
        <RRow label={`Stopaj (%${fmtN(r.sOran)})`} value={`- ${fmtTL(r.stop)}`} sub accent={C.red}/>
        <RRow label="Net Kâr Payı" value={fmtTL(r.nf)} accent={C.green} big/>
        <RRow label="Vade Sonu Tutar" value={fmtTL(r.nv)} accent={C.blue} big/>
        <RRow label="Efektif Net Yıllık Kâr Payı %" value={`% ${fmtN(r.ey)}`} sub/>
        <button onClick={()=>{if(onGecmis&&r){onGecmis({modul:"Katılım Hesabı Getiri",tutar:fmtTL(parseFloat(tutar)),vade:gun+" Gün",oran:oran+"% (Brüt)",sonuc:fmtTL(r?.bf),netGetiri:fmtTL(r?.nf),aylikTaksit:"-",plan:[]});setKaydedildi(true);setTimeout(()=>setKaydedildi(false),2000);}}} style={{width:"100%",marginTop:6,marginBottom:2,padding:"10px",borderRadius:12,border:`1.5px solid ${kaydedildi?C.green:C.blue}`,background:kaydedildi?C.greenLight:C.blueLight,color:kaydedildi?C.green:C.blue,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>
          {kaydedildi?"✅ Kaydedildi":"🕐 Geçmişe Kaydet"}
        </button>
        <RaporButon baslik="Katılım Hesabı Getiri Analizi" satirlar={[
          {label:"Katılım Hesabı Tutarı", value:`${doviz==="TL"?"₺":doviz==="USD"?"$":"€"}${fmtN(parseFloat(tutar)||0,2)}`},
          {label:"Vade", value:`${gun} Gün`},
          {label:"Basit Oran (Yıllık)", value:`% ${fmtN(parseFloat(oran)||0,2)}`},
          {label:"Brüt Kâr Payı", value:fmtTL(r.bf)},
          {label:`Stopaj (%${fmtN(r.sOran)})`, value:`- ${fmtTL(r.stop)}`},
          {label:"Net Kâr Payı", value:fmtTL(r.nf)},
          {label:"Vade Sonu Tutar", value:fmtTL(r.nv)},
          {label:"Efektif Net Yıllık %", value:`% ${fmtN(r.ey)}`},
        ]}/>
      </Card>}
    </div>
  );
}

function GetiridenAnapara({s}){
  const [hedefGetiri,setHedefGetiri]=useState("");
  const [gun,setGun]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");

  const r=useCallback(()=>{
    const G2=parseFloat(hedefGetiri),GUN=parseInt(gun),rt=parseFloat(oran);
    if(!G2||!GUN||!rt)return null;
    const go=tip==="yillik"?rt/100/365:rt/100;
    const sOran=GUN<=180?s.stopajTL_0_180:GUN<=365?s.stopajTL_181_365:s.stopajTL_365plus;
    const netOran=go*GUN*(1-sOran/100);
    const anapara=G2/netOran;
    const bf=anapara*go*GUN;
    const stop=bf*(sOran/100);
    return{anapara,bf,stop,netKarPayi:G2,sOran};
  },[hedefGetiri,gun,oran,tip,s])();

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"aylik",l:"Günlük %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Hedef Net Kâr Payı (₺)" value={hedefGetiri} onChange={setHedefGetiri} suffix="₺"/>
        <Field label="Vade (Gün)" value={gun} onChange={setGun} suffix="Gün"/>
        <Field label="Kâr Payı Oranı (Yıllık)" value={oran} onChange={setOran} suffix="%"/>
      </Card>
      {r&&<Card>
        <SecTitle>Gerekli Anapara</SecTitle>
        <RRow label="Gerekli Anapara" value={fmtTL(r.anapara)} accent={C.blue} big/>
        <RRow label="Brüt Kâr Payı" value={fmtTL(r.bf)}/>
        <RRow label={`Stopaj (%${fmtN(r.sOran)})`} value={`- ${fmtTL(r.stop)}`} sub accent={C.red}/>
        <RRow label="Net Kâr Payı" value={fmtTL(r.netKarPayi)} accent={C.green} big/>
      </Card>}
    </div>
  );
}

function OranAnalizi({s}){
  const [seg,setSeg]=useState("bireysel"); // bireysel | tuzel
  const [tutar,setTutar]=useState("");
  const [gun] = useState("1");
  const [netGetiri,setNetGetiri]=useState("");
  const [showLimits,setShowLimits]=useState(false);

  // ─── Bireysel CARI_TABLO ──────────────────────────────────────────────────
  const BIREYSEL_TABLO=[
    {min:10000,    max:24999,    cari:5000},
    {min:25000,    max:49999,    cari:7500},
    {min:50000,    max:99999,    cari:10000},
    {min:100000,   max:249999,   cari:25000},
    {min:250000,   max:499999,   cari:50000},
    {min:500000,   max:999999,   cari:100000},
    {min:1000000,  max:1999999,  cari:200000},
    {min:2000000,  max:2999999,  cari:300000},
    {min:3000000,  max:3999999,  cari:400000},
    {min:4000000,  max:4999999,  cari:500000},
    {min:5000000,  max:10000000, cari:750000},
    {min:10000000, max:Infinity, cari:2000000},
  ];

  // ─── Tüzel CARI_TABLO ─────────────────────────────────────────────────────
  const TUZEL_TABLO=[
    {min:100000,      max:250000,      cari:30000},
    {min:250001,      max:500000,      cari:60000},
    {min:500001,      max:1000000,     cari:120000},
    {min:1000001,     max:2500000,     cari:300000},
    {min:2500001,     max:5000000,     cari:600000},
    {min:5000001,     max:7500000,     cari:900000},
    {min:7500001,     max:10000000,    cari:1200000},
    {min:10000001,    max:20000000,    cari:2400000},
    {min:20000001,    max:50000000,    cari:6000000},
    {min:50000001,    max:100000000,   cari:12000000},
    {min:100000001,   max:500000000,   cari:60000000},
  ];

  const AKTIF_TABLO = seg==="bireysel" ? BIREYSEL_TABLO : TUZEL_TABLO;

  const getCariTutar=(v)=>{
    const V=parseFloat(v)||0;
    if(V<=0) return null;
    const b=AKTIF_TABLO.find(b=>V>=b.min&&V<=b.max);
    return b?b.cari:null;
  };

  const cariTutar=getCariTutar(tutar);
  const toplamPozisyon=cariTutar?(parseFloat(tutar)||0)+cariTutar:(parseFloat(tutar)||0);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),G=parseInt(gun),KP=parseFloat(netGetiri);
    if(!T||!G||!KP)return null;
    if(T<10000) return{limitAsim:true,altLimit:true};
    if(seg==="bireysel"&&T>100000000) return{limitAsim:true,ustLimit:true};
    const sOran=G<=180?s.stopajTL_0_180:G<=365?s.stopajTL_181_365:s.stopajTL_365plus;
    const netGunluk=(KP/T)/G*100;
    const brutGunluk=netGunluk/(1-sOran/100);
    return{brutYillik:brutGunluk*365,netYillik:netGunluk*365,sOran};
  },[tutar,gun,netGetiri,seg,s])();

  // ─── Tablo style helpers ──────────────────────────────────────────────────
  const thT=(bg)=>({padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:bg||"#1C3A5E",letterSpacing:"0.04em",textAlign:"left"});
  const tdT=(bold)=>({padding:"7px 10px",fontSize:12,borderBottom:"1px solid rgba(255,255,255,0.08)",fontWeight:bold?700:400,fontFamily:bold?"monospace":"inherit"});
  const fmt=(n)=>new Intl.NumberFormat("tr-TR").format(n);

  // ─── Yeni müşteri limit tablosu (modal için) ─────────────────────────────
  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Limit Tablosu Modal */}
      {showLimits&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:800,color:C.label}}>📋 {seg==="bireysel"?"Bireysel":"Tüzel"} Günlük Hesap İşlem Limitleri</span>
              <button onClick={()=>setShowLimits(false)} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"14px 16px 28px"}}>
              {seg==="bireysel" ? (<>
                <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:C.blue,textTransform:"uppercase"}}>🆕 Yeni Müşteri</p>
                <div style={{background:"rgba(91,155,216,0.12)",borderRadius:8,padding:"6px 10px",marginBottom:8}}>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>Hoş geldin süresi: <strong>45 gün</strong> · Kâr paylaşım oranı: <strong>99/1</strong></p>
                </div>
                <div style={{overflowX:"auto",marginBottom:18}}>
                  <table style={{borderCollapse:"collapse",width:"100%",minWidth:280}}>
                    <thead><tr>
                      <th style={thT()}>Bakiye Bandı</th>
                      <th style={{...thT(),textAlign:"right"}}>Cari Tutar</th>
                    </tr></thead>
                    <tbody>
                      {[{b:"10.000–24.999",c:5000},{b:"25.000–49.999",c:7500},{b:"50.000–99.999",c:10000},
                        {b:"100.000–249.999",c:25000},{b:"250.000–499.999",c:50000},{b:"500.000–999.999",c:100000},
                        {b:"1.000.000–1.999.999",c:200000},{b:"2.000.000–2.999.999",c:300000},
                        {b:"3.000.000–3.999.999",c:400000},{b:"4.000.000–4.999.999",c:500000},
                        {b:"5.000.000–10.000.000",c:750000},
                      ].map((r,i)=>(
                        <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.05)"}}>
                          <td style={tdT(false)}>{r.b} ₺</td>
                          <td style={{...tdT(true),textAlign:"right"}}>{fmt(r.c)} ₺</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:C.green,textTransform:"uppercase"}}>👤 Mevcut Müşteri</p>
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",width:"100%",minWidth:300}}>
                    <thead><tr>
                      <th style={thT("#1A5C4A")}>Bakiye Bandı</th>
                      <th style={{...thT("#1A5C4A"),textAlign:"right"}}>Cari Tutar</th>
                      <th style={{...thT("#1A5C4A"),textAlign:"right"}}>Oran</th>
                    </tr></thead>
                    <tbody>
                      {[{b:"10.000–24.999",c:5000,o:"85/15"},{b:"25.000–49.999",c:7500,o:"85/15"},
                        {b:"50.000–99.999",c:10000,o:"85/15"},{b:"100.000–249.999",c:25000,o:"85/15"},
                        {b:"250.000–499.999",c:50000,o:"85/15"},{b:"500.000–999.999",c:100000,o:"85/15"},
                        {b:"1.000.000–1.999.999",c:200000,o:"85/15"},{b:"2.000.000–2.999.999",c:300000,o:"85/15"},
                        {b:"3.000.000–3.999.999",c:400000,o:"85/15"},{b:"4.000.000–4.999.999",c:500000,o:"85/15"},
                        {b:"5.000.000–10.000.000",c:750000,o:"90/10"},{b:"10.000.000+",c:2000000,o:"80/20"},
                      ].map((r,i)=>(
                        <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.05)"}}>
                          <td style={tdT(false)}>{r.b} ₺</td>
                          <td style={{...tdT(true),textAlign:"right"}}>{fmt(r.c)} ₺</td>
                          <td style={{...tdT(true),textAlign:"right",color:C.green}}>{r.o}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>) : (<>
              <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:C.orange,textTransform:"uppercase"}}>🏢 Tüzel Müşteri</p>
              <div style={{background:"rgba(224,165,61,0.12)",borderRadius:8,padding:"6px 10px",marginBottom:8}}>
                <p style={{margin:0,fontSize:10,color:C.sub}}>Standart oran: <strong>95/5</strong></p>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",width:"100%",minWidth:300}}>
                  <thead><tr>
                    <th style={thT("#7A5000")}>Bakiye Bandı</th>
                    <th style={{...thT("#7A5000"),textAlign:"right"}}>Cari Tutar</th>
                  </tr></thead>
                  <tbody>
                    {TUZEL_TABLO.map((b,i)=>(
                      <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.05)"}}>
                        <td style={tdT(false)}>{fmt(b.min)} – {b.max===Infinity?fmt(b.min)+"+":fmt(b.max)} ₺</td>
                        <td style={{...tdT(true),textAlign:"right"}}>{fmt(b.cari)} ₺</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>)}
            </div>
          </div>
        </div>
      )}

      <Card>
        <Seg options={[{v:"bireysel",l:"Bireysel"},{v:"tuzel",l:"Tüzel"}]} value={seg} onChange={v=>{setSeg(v);setTutar("");setNetGetiri("");}}/>
        <Field label="Günlük Hesap Bakiyesi" value={tutar} onChange={setTutar} suffix="₺"/>
        <button onClick={()=>setShowLimits(true)} style={{width:"100%",marginBottom:12,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
          <span>📋</span> Günlük Hesap İşlem Limitlerini Görüntüle
        </button>

        {/* Cari Bloke Tutarı */}
        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Cari Bloke Tutarı</label>
          {cariTutar!=null?(
            <div style={{padding:"11px 40px 11px 13px",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,fontWeight:600,fontFamily:"monospace",color:"#F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>{fmt(cariTutar)}</span>
              <span style={{fontSize:13,fontWeight:700,color:C.blue}}>₺</span>
            </div>
          ):(
            <div style={{padding:"11px 13px",background:"rgba(255,255,255,0.04)",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:13,color:C.sub}}>
              {parseFloat(tutar)>0?"Tablo kapsamı dışı":"Bakiye girilince otomatik hesaplanır"}
            </div>
          )}
        </div>

        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Vade (Gün)</label>
          <div style={{padding:"11px 40px 11px 13px",background:"rgba(255,255,255,0.04)",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,fontWeight:600,fontFamily:"monospace",color:C.sub,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>1</span>
            <span style={{fontSize:13,fontWeight:700,color:C.blue}}>Gün</span>
          </div>
        </div>
        <Field label="Net Kâr Payı" value={netGetiri} onChange={setNetGetiri} suffix="₺" hint="Aldığınız net kâr payı tutarı"/>
      </Card>

      {r?.limitAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:14,padding:"14px 16px",marginBottom:10,border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 2px",fontSize:14,fontWeight:800,color:C.red}}>⛔ {r.altLimit?"Asgari Tutar":"Azami Tutar"} Aşıldı</p>
        <p style={{margin:0,fontSize:12,color:C.red}}>{r.altLimit?"Minimum açılış tutarı 10.000 ₺'dir.":"Maksimum açılış tutarı 100.000.000 ₺'dir."}</p>
      </div>}

      {r&&!r.limitAsim&&<Card>
        <SecTitle>Oran Analizi</SecTitle>
        <RRow label="Brüt Yıllık Basit Oran" value={`% ${fmtN(r.brutYillik)}`} big/>
        <RRow label="Net Yıllık Oran" value={`% ${fmtN(r.netYillik)}`} accent={C.green}/>
        <RRow label="Stopaj Oranı" value={`% ${fmtN(r.sOran)}`} sub/>
        {cariTutar&&<>
          <div style={{height:1,background:C.border,margin:"8px 0"}}/>
          <RRow label="Günlük Hesap Bakiyesi" value={`₺${fmt(parseFloat(tutar))}`} sub/>
          <RRow label="Cari Bloke Tutarı" value={`₺${fmt(cariTutar)}`} sub/>
          <RRow label="Toplam Pozisyon" value={`₺${fmt(toplamPozisyon)}`} accent={C.purple} big/>
          <RRow label="Toplam Pozisyon Bazlı Brüt Yıllık Oran"
            value={`% ${fmtN((parseFloat(netGetiri)/toplamPozisyon*100/(1-r.sOran/100))*365)}`}
            accent={C.teal} big/>
          <RRow label="Toplam Pozisyon Bazlı Net Yıllık Oran"
            value={`% ${fmtN((parseFloat(netGetiri)/toplamPozisyon*100)*365)}`}
            accent={C.green} big/>
        </>}
      </Card>}
    </div>
  );
}

function OdemePlani({plan, bsmvOran, kkdfOran, onClose, showKomisyon, basitOran, efektifOran, anaparaTutar, taksitAraligiGun}){
  const bsmv=bsmvOran||0, kkdf=kkdfOran||0;
  const hasBsmv=bsmv>0, hasKkdf=kkdf>0, hasTax=(bsmv+kkdf)>0;
  const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const now=new Date();
  const getTarih=(idx)=>{
    if(taksitAraligiGun){
      const d=new Date(now); d.setDate(d.getDate()+taksitAraligiGun*(idx+1));
      return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
    const tot=now.getMonth()+1+idx;return MONTHS[tot%12]+' '+(now.getFullYear()+Math.floor(tot/12));
  };
  const totTaksit=plan.reduce((a,r)=>a+r.toplam,0);
  const totAna=plan.reduce((a,r)=>a+r.anapara,0);
  const totKar=plan.reduce((a,r)=>a+r.karPayi,0);
  const totBsmv=plan.reduce((a,r)=>a+r.karPayi*(bsmv/100),0);
  const totKkdf=plan.reduce((a,r)=>a+r.karPayi*(kkdf/100),0);
  const thStyle={padding:"5px 4px",color:"#fff",fontWeight:700,fontSize:9,whiteSpace:"nowrap",textAlign:"right",background:"#1C3A5E",letterSpacing:"0.04em"};
  const tdStyle=(color)=>({padding:"5px 4px",fontFamily:"monospace",fontSize:10,textAlign:"right",color:color||C.label,whiteSpace:"nowrap"});
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:C.label}}>📅 Aylık Ödeme Planı</span>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{flex:"1 1 40%",padding:"8px 10px",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>ANAPARA</p>
            <p style={{margin:"1px 0 0",fontSize:12,fontWeight:800,color:C.blue}}>{fmtTL(anaparaTutar||totAna)}</p>
          </div>
          <div style={{flex:"1 1 40%",padding:"8px 10px",borderBottom:`1px solid ${C.border}`}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>KÂR PAYI</p>
            <p style={{margin:"1px 0 0",fontSize:12,fontWeight:800,color:C.orange}}>{fmtTL(totKar)}</p>
          </div>
          <div style={{flex:"1 1 40%",padding:"8px 10px",borderRight:hasTax||showKomisyon?`1px solid ${C.border}`:"none"}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>TOPLAM TAKSİT</p>
            <p style={{margin:"1px 0 0",fontSize:12,fontWeight:800,color:C.blue}}>{fmtTL(totTaksit)}</p>
          </div>
          {hasTax&&!showKomisyon&&<div style={{flex:"1 1 40%",padding:"8px 10px"}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>VERGİ</p>
            <p style={{margin:"1px 0 0",fontSize:12,fontWeight:800,color:C.red}}>{fmtTL(totBsmv+totKkdf)}</p>
          </div>}
          {showKomisyon&&<div style={{flex:"1 1 40%",padding:"8px 10px"}}>
            <p style={{margin:0,fontSize:8,fontWeight:700,color:"#9C3060",letterSpacing:"0.06em"}}>KOMİSYON</p>
            <p style={{margin:"2px 0 0",fontSize:12,fontWeight:800,color:"#9C3060"}}>{fmtTL(plan.reduce((a,r)=>a+(r.komisyon||0),0))}</p>
          </div>}
        </div>
        {(basitOran||efektifOran)&&<div style={{display:"flex",gap:1,background:C.border,flexShrink:0}}>
          {basitOran>0&&<div style={{flex:1,padding:"7px 12px",background:C.card}}>
            <p style={{margin:0,fontSize:9,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>BASİT YILLIK ORAN</p>
            <p style={{margin:"1px 0 0",fontSize:13,fontWeight:800,color:C.blue}}>% {fmtN(basitOran,2)}</p>
          </div>}
          {efektifOran>0&&<div style={{flex:1,padding:"7px 12px",background:C.card}}>
            <p style={{margin:0,fontSize:9,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>EFEKTİF YILLIK ORAN</p>
            <p style={{margin:"1px 0 0",fontSize:13,fontWeight:800,color:C.green}}>% {fmtN(efektifOran,2)}</p>
          </div>}
        </div>}
        <div style={{flex:1,overflow:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:hasTax?520:400}}>
            <thead>
              <tr>
                <th style={{...thStyle,textAlign:"left"}}>No</th>
                <th style={{...thStyle,textAlign:"left"}}>Tarih</th>
                <th style={thStyle}>Taksit</th>
                <th style={thStyle}>Anapara</th>
                <th style={thStyle}>Kâr Payı</th>
                {hasBsmv&&<th style={thStyle}>BSMV%{bsmv}</th>}
                {hasKkdf&&<th style={thStyle}>KKDF%{kkdf}</th>}
                <th style={thStyle}>Kalan</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((row,i)=>(
                <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.03)":"transparent",borderBottom:`1px solid ${C.border}`}}>
                  <td style={{...tdStyle(C.blue),textAlign:"left",fontWeight:700}}>{row.ay}</td>
                  <td style={{...tdStyle(C.label),textAlign:"left",fontFamily:"inherit",fontSize:11}}>{getTarih(i)}</td>
                  <td style={{...tdStyle(),fontWeight:700}}>{fmtN(row.toplam,2)}</td>
                  <td style={tdStyle(C.sub)}>{fmtN(row.anapara,2)}</td>
                  <td style={tdStyle(C.orange)}>{fmtN(row.karPayi,2)}</td>
                  {hasBsmv&&<td style={tdStyle(C.red)}>{fmtN(row.karPayi*(bsmv/100),2)}</td>}
                  {hasKkdf&&<td style={tdStyle("#9C3060")}>{fmtN(row.karPayi*(kkdf/100),2)}</td>}
                  <td style={tdStyle(C.sub)}>{fmtN(row.bakiye,2)}</td>
                </tr>
              ))}
              <tr style={{background:"rgba(91,155,216,0.15)",borderTop:`2px solid ${C.blue}`}}>
                <td style={{...tdStyle(C.blue),textAlign:"left",fontWeight:800}}>∑</td>
                <td style={{...tdStyle(C.label),textAlign:"left",fontFamily:"inherit",fontWeight:800}}>TOPLAM</td>
                <td style={{...tdStyle(),fontWeight:800}}>{fmtN(totTaksit,2)}</td>
                <td style={{...tdStyle(C.sub),fontWeight:800}}>{fmtN(totAna,2)}</td>
                <td style={{...tdStyle(C.orange),fontWeight:800}}>{fmtN(totKar,2)}</td>
                {hasBsmv&&<td style={{...tdStyle(C.red),fontWeight:800}}>{fmtN(totBsmv,2)}</td>}
                {hasKkdf&&<td style={{...tdStyle("#9C3060"),fontWeight:800}}>{fmtN(totKkdf,2)}</td>}
                <td style={{...tdStyle(C.sub),fontWeight:800}}>0,00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function hesaplaOdemePlani(T, V, ao, bsmvOran, kkdfOran){
  const bsmv=(bsmvOran||0)/100;
  const kkdf=(kkdfOran||0)/100;
  const vergiOran=bsmv+kkdf;

  // Net PMT (anapara + kâr payı) - sabit
  const pmt = ao===0 ? T/V : T*ao/(1-Math.pow(1+ao,-V));
  const pmtFixed = Math.round(pmt*100)/100;

  // Sabit vergi: ilk ay kâr payı üzerinden — her ay aynı toplam taksit için
  const ilkAyKarPayi = Math.round(T*ao*100)/100;
  const sabitVergi = Math.round(ilkAyKarPayi*vergiOran*100)/100;
  // TOPLAM SABİT TAKSİT = her ay aynı
  const toplamSabitTaksit = Math.round((pmtFixed+sabitVergi)*100)/100;

  const plan=[];
  let bakiye=Math.round(T*100)/100;

  for(let i=1;i<=V;i++){
    const karPayi = Math.round(bakiye*ao*100)/100;
    const anapara = Math.round((pmtFixed-karPayi)*100)/100;
    const vergi   = Math.round(karPayi*vergiOran*100)/100;
    bakiye = Math.max(0, Math.round((bakiye-anapara)*100)/100);
    plan.push({ay:i, karPayi, anapara, vergi,
      toplam: toplamSabitTaksit,  // her ay SABİT
      bakiye});
  }
  // toplamSabitTaksit'i dışarı da döndür
  plan._toplamSabitTaksit = toplamSabitTaksit;
  return plan;
}

// ─── RAPOR / PAYLAŞ ──────────────────────────────────────────────────────────
// ─── RAPOR ÖNİZLEME + PAYLAŞ ────────────────────────────────────────────────
function RaporModal({baslik, satirlar, plan, onClose, showKdv=false, bsmvOran=0, kkdfOran=0}){
  const [yukleniyor, setYukleniyor] = useState(false);
  const tarih = new Date().toLocaleString("tr-TR");
  const fmt=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

  const pdfOlusturVePaylas = async () => {
    setYukleniyor(true);
    try {
      // Geçici div oluştur — rapor HTML'i
      const div = document.createElement("div");
      div.style.cssText = "position:fixed;left:-9999px;top:0;width:595px;background:#fff;font-family:Arial,sans-serif;padding:0;";
      document.body.appendChild(div);

      const planSatirlari = plan && plan.length > 0 ? plan.filter(r=>r&&!r._toplamSabitTaksit) : [];
      const totTaksit = planSatirlari.reduce((s,r)=>s+(r.taksit||r.toplam||0),0);
      const totKP = planSatirlari.reduce((s,r)=>s+(r.karPayi||r.faiz||0),0);
      const totAna = planSatirlari.reduce((s,r)=>s+(r.anapara||0),0);
      const totKDV = planSatirlari.reduce((s,r)=>s+(r.kdvTutar||r.vergi||0),0);

      div.innerHTML = `
        <div style="background:#1C3A5E;padding:20px 24px 16px;">
          <div style="font-size:18px;color:#fff;font-weight:800;margin-bottom:4px;">${baslik}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.65);">${tarih}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;">Vakıf Katılım Bankası — Fon Fiyatlama Müdürlüğü</div>
        </div>
        <div style="padding:0;">
          ${satirlar.filter(s=>s?.label).map((s,i)=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:${s.big?"11px":"8px"} 24px;background:${s.big?"rgba(91,155,216,0.15)":i%2===0?"#FAFBFC":"#fff"};border-bottom:1px solid rgba(255,255,255,0.1);">
              <span style="font-size:${s.big?12:11}px;color:${s.big?"#1C3A5E":"#6B7280"};font-weight:${s.big?700:500};">${s.label}</span>
              <span style="font-size:${s.big?14:12}px;color:${s.big?"#1C3A5E":"#1a1a1a"};font-weight:${s.big?900:600};font-family:monospace;">${s.value}</span>
            </div>`).join("")}
        </div>
        ${planSatirlari.length>0?`
        <div style="margin-top:4px;">
          <div style="background:#1C3A5E;padding:9px 24px;">
            <span style="font-size:11px;font-weight:700;color:#fff;">ÖDEME PLANI — ${planSatirlari.length} TAKSİT</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:8px;">
            <thead>
              <tr style="background:#EBF3FB;">
                <th style="padding:5px 4px;text-align:center;color:#1C3A5E;font-weight:700;border-bottom:1px solid #D1E0EF;">#</th>
                ${(showKdv?["Taksit","Kâr Payı","Anapara","KDV","Kalan"]:["Taksit","Kâr Payı","Anapara","BSMV","KKDF","Kalan"]).map(h=>`<th style="padding:5px 4px;text-align:right;color:#1C3A5E;font-weight:700;border-bottom:1px solid #D1E0EF;">${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${planSatirlari.map((r,i)=>{
                const vals = showKdv
                  ? [r.taksit||r.toplam, r.karPayi||r.faiz, r.anapara, r.kdvTutar||r.vergi||0, r.bakiye]
                  : [r.taksit||r.toplam, r.karPayi||r.faiz, r.anapara, (r.karPayi||0)*bsmvOran/100, (r.karPayi||0)*kkdfOran/100, r.bakiye];
                return `<tr style="background:${i%2===0?"#F8FAFB":"#fff"};border-bottom:1px solid rgba(255,255,255,0.1);">
                  <td style="padding:4px;text-align:center;color:#6B7280;font-weight:600;">${r.ay||i+1}</td>
                  ${vals.map(v=>`<td style="padding:4px;text-align:right;font-family:monospace;color:#1a1a1a;">${fmt(v)}</td>`).join("")}
                </tr>`;
              }).join("")}
              <tr style="background:#1C3A5E;">
                <td style="padding:5px 4px;text-align:center;color:#fff;font-weight:800;font-size:9px;">∑</td>
                ${(showKdv
                  ? [totTaksit,totKP,totAna,totKDV,"—"]
                  : [totTaksit,totKP,totAna,planSatirlari.reduce((s,r)=>s+(r.karPayi||0)*bsmvOran/100,0),planSatirlari.reduce((s,r)=>s+(r.karPayi||0)*kkdfOran/100,0),"—"]
                ).map(v=>`<td style="padding:5px 4px;text-align:right;color:#fff;font-weight:800;font-family:monospace;font-size:8px;">${typeof v==="number"?fmt(v):v}</td>`).join("")}
              </tr>
            </tbody>
          </table>
        </div>`:""}
        <div style="margin:16px 24px;padding:12px 16px;background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:4px;">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <span style="font-size:16px;flex-shrink:0;">⚠️</span>
            <p style="margin:0;font-size:10px;color:#374151;font-style:italic;line-height:1.7;">
              Bu hesaplamalar yalnızca bilgilendirme amaçlıdır; kesin teklif, resmi belge veya hukuki taahhüt niteliği taşımaz. Nihai oranlar ve koşullar için yetkili biriminizle iletişime geçiniz.
            </p>
          </div>
        </div>
      `;

      // window.print() ile PDF
      const printWindow = window.open("", "_blank", "width=650,height=900");
      if(!printWindow){ document.body.removeChild(div); setYukleniyor(false); return; }
      printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${baslik}</title><style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,Helvetica,sans-serif;background:#fff;}
        @media print{@page{margin:0;size:A4;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
      </style></head><body>${div.innerHTML}</body></html>`);
      printWindow.document.close();
      document.body.removeChild(div);

      // Kısa bekle sonra print dialog aç
      setTimeout(()=>{
        printWindow.focus();
        printWindow.print();
        // iOS'ta print dialog = paylaş menüsü (PDF kaydet, Mail, WhatsApp vs.)
        setTimeout(()=>{ try{ printWindow.close(); }catch(e){} }, 3000);
      }, 600);

    } catch(e) {
      alert("PDF oluşturulurken hata: " + e.message);
    }
    setYukleniyor(false);
  };

  // Ana modal
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:C.label}}>📤 Rapor / Paylaş</span>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 18px"}}>
          {satirlar.filter(s=>s?.label).map((s,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.sub}}>{s.label}</span>
              <span style={{fontSize:13,fontWeight:s.big?800:600,color:s.big?C.blue:C.label}}>{s.value}</span>
            </div>
          ))}
          {plan&&plan.length>0&&(
            <div style={{marginTop:12,background:C.blueLight,borderRadius:10,padding:"10px 12px"}}>
              <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:700}}>📋 {plan.length} satır ödeme planı PDF'e dahil edilecek</p>
            </div>
          )}
        </div>
        <div style={{padding:"12px 18px 28px",flexShrink:0}}>
          <button onClick={pdfOlusturVePaylas} disabled={yukleniyor} style={{
            width:"100%",padding:"15px",borderRadius:14,border:"none",
            background:yukleniyor?"#6B7280":C.blue,color:"#fff",
            fontWeight:800,fontSize:16,cursor:yukleniyor?"not-allowed":"pointer",
            boxShadow:"0 4px 14px rgba(28,58,94,0.3)"
          }}>
            {yukleniyor ? "⏳ Hazırlanıyor..." : "📄 PDF Oluştur & Paylaş"}
          </button>
          <p style={{margin:"10px 0 0",fontSize:11,color:"#9CA3AF",textAlign:"center",lineHeight:1.5}}>
            PDF önizleme açılır → Paylaş butonundan Mail, WhatsApp veya Dosyalar'a kaydedebilirsiniz
          </p>
        </div>
      </div>
    </div>
  );
}

function RaporButon({baslik, satirlar, plan, showKdv=false, bsmvOran=0, kkdfOran=0}){
  const [show, setShow] = useState(false);
  return(
    <>
      {show && <RaporModal baslik={baslik} satirlar={satirlar} plan={plan} onClose={()=>setShow(false)} showKdv={showKdv} bsmvOran={bsmvOran} kkdfOran={kkdfOran}/>}
      <button onClick={()=>setShow(true)} style={{
        width:"100%",marginTop:8,padding:"12px",borderRadius:12,
        border:`1.5px solid ${C.blue}`,background:C.blueLight,
        color:C.blue,fontWeight:700,fontSize:14,cursor:"pointer"
      }}>
        📤 Rapor / Paylaş
      </button>
    </>
  );
}

// ─── KALAN ANAPARA MODAL (ceza yok) ────────────────────────────────────────
function KalanAnaparaModal({plan, onClose, showCeza=false}){
  const [kapamaAyi, setKapamaAyi] = useState("");
  const ayNum = parseInt(kapamaAyi)||0;
  const row = plan && ayNum>=1 && ayNum<=plan.length ? plan[ayNum-1] : null;
  const kalanBakiye = row ? row.bakiye : null;
  const odenenToplam = plan ? plan.slice(0,ayNum).reduce((a,r)=>a+r.toplam,0) : 0;
  // Erken kapama cezası: kalan vade ≤36 ay → max %1, >36 ay → max %2
  const kalanVade = plan ? plan.length - ayNum : 0;
  const cezaOran = showCeza ? (kalanVade <= 36 ? 1 : 2) : 0;
  const cezaTutar = kalanBakiye ? Math.round(kalanBakiye * cezaOran / 100 * 100) / 100 : 0;
  const toplamKapama = kalanBakiye ? kalanBakiye + cezaTutar : 0;

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",overflowY:"auto",padding:"20px 18px 36px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:16,fontWeight:800,color:C.label}}>⚡ Erken Kapama</span>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{background:C.blueLight,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          {showCeza
            ? <p style={{margin:0,fontSize:12,color:C.blue,lineHeight:1.5}}>
                Kalan vade ≤ 36 ay ise max <strong>%1</strong>, 36 aydan uzun ise max <strong>%2</strong> erken kapama cezası uygulanabilir.
              </p>
            : <p style={{margin:0,fontSize:12,color:C.blue,lineHeight:1.5}}>
                Bu finansman türünde erken kapama ücreti uygulanmaz. Kalan anapara tutarı ile kapatılır.
              </p>}
        </div>
        <Field label="Kaçıncı ayda kapanıyor?" value={kapamaAyi} onChange={setKapamaAyi} suffix="Ay" hint={plan?`Toplam vade: ${plan.length} ay`:""}/>
        {row&&(
          <>
            <div style={{background:C.blueLight,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
              <p style={{margin:"0 0 4px",fontSize:12,color:C.sub,fontWeight:600}}>{ayNum}. AY SONU KALAN ANAPARA</p>
              <p style={{margin:0,fontSize:28,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>{fmtTL(kalanBakiye)}</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"11px 13px"}}>
                <p style={{margin:"0 0 2px",fontSize:11,color:C.sub,fontWeight:600}}>Ödenen Taksit</p>
                <p style={{margin:0,fontSize:17,fontWeight:800,color:C.label}}>{ayNum} ay</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"11px 13px"}}>
                <p style={{margin:"0 0 2px",fontSize:11,color:C.sub,fontWeight:600}}>Kalan Vade</p>
                <p style={{margin:0,fontSize:17,fontWeight:800,color:C.orange}}>{plan.length-ayNum} ay</p>
              </div>
            </div>
            {showCeza&&cezaTutar>0&&(
              <div style={{background:"rgba(224,165,61,0.12)",borderRadius:12,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${C.orange}`}}>
                <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:C.orange}}>Erken Kapama Cezası (Max %{cezaOran})</p>
                <p style={{margin:0,fontSize:20,fontWeight:900,color:C.orange,fontFamily:"monospace"}}>{fmtTL(cezaTutar)}</p>
                <p style={{margin:"3px 0 0",fontSize:10,color:C.sub}}>Kalan vade: {kalanVade} ay → %{cezaOran} azami oran</p>
              </div>
            )}
            <div style={{background:C.greenLight,borderRadius:12,padding:"14px 16px",border:`1.5px solid ${C.green}`}}>
              <p style={{margin:0,fontSize:13,fontWeight:700,color:C.green}}>
                ✅ Erken Kapama Tutarı
              </p>
              <p style={{margin:"6px 0 0",fontSize:24,fontWeight:900,color:C.green,fontFamily:"monospace"}}>
                {fmtTL(showCeza?toplamKapama:kalanBakiye)}
              </p>
              <p style={{margin:"4px 0 0",fontSize:11,color:C.sub}}>
                {showCeza&&cezaTutar>0
                  ? `Kalan anapara ${fmtTL(kalanBakiye)} + ceza ${fmtTL(cezaTutar)}`
                  : `Ödenen ${ayNum} taksit (${fmtTL(odenenToplam)}) + kalan anapara — ceza uygulanmaz`}
              </p>
            </div>
          </>
        )}
        {kapamaAyi&&!row&&(
          <div style={{background:"rgba(248,113,113,0.12)",borderRadius:10,padding:"11px 14px"}}>
            <p style={{margin:0,fontSize:13,color:C.red,fontWeight:700}}>⛔ Geçersiz ay — 1 ile {plan?.length||"?"} arasında girin</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── ERKEN KAPAMA MODALI ─────────────────────────────────────────────────────
function KonutFinansman({s,onGecmis})/* v2 */{
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [deger,setDeger]=useState("");
  const [enerji,setEnerji]=useState("AB");
  const [ilkEv,setIlkEv]=useState(true);
  const [showLimits,setShowLimits]=useState(false);
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const AZAMI_KULL_BIR=0.50; // Bireysel azami %0,50 (binde 5)

  // LTV tablosu — Tablo 1: İlk Ev (Ailenin farklı konutu YOK)
  const getLTV_ilkEv=(d,e)=>{
    if(d<=5000000)  return e==="AB"?90:e==="C"?80:70;
    if(d<=7000000)  return e==="AB"?80:e==="C"?70:60;
    if(d<=10000000) return e==="AB"?70:e==="C"?60:50;
    if(d<=20000000) return e==="AB"?50:e==="C"?40:30;
    return e==="AB"?40:e==="C"?30:20;
  };
  // LTV tablosu — Tablo 2: İkinci Ev (Ailenin farklı konutu VAR)
  const getLTV_ikinciEv=(d,e)=>{
    if(d<=5000000)  return e==="AB"?22.5:e==="C"?20:17.5;
    if(d<=7000000)  return e==="AB"?20:e==="C"?17.5:15;
    if(d<=10000000) return e==="AB"?17.5:e==="C"?15:12.5;
    if(d<=20000000) return e==="AB"?12.5:e==="C"?10:7.5;
    return e==="AB"?10:e==="C"?7.5:5;
  };
  const getLTV=(d,e)=>ilkEv?getLTV_ilkEv(d,e):getLTV_ikinciEv(d,e);

  const prevVadeRefK=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRefK.current){
      prevVadeRefK.current=vade;
      const V=parseInt(vade);
      if(V>0){
        const azami=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
        setKullKomisyon(fmtN(azami,4).replace(",","."));
      }
    }
  },[vade]);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    if(!T||!V||!rt)return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;
    if(deger){
      const D=parseFloat(deger);
      const maxLTV=getLTV(D,enerji);
      const maxFin=Math.round(D*(maxLTV/100));
      if(T>maxFin) return{ltvAsim:true,maxFin,maxLTV,gercekLTV:(T/D)*100};
    }
    // İlk evde BSMV ve KKDF yok
    const bsmvR=ilkEv?0:s.bireyselBSMV;
    const kkdfR=0; // Konut finansmanında KKDF uygulanmaz (ilk ev veya ikinci ev)
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=pmt*V;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=toplamKarPayi*(bsmvR/100);
    const kkdfTL=toplamKarPayi*(kkdfR/100);
    const musteriFark=toplamKarPayi+bsmvTL+kkdfTL;
    const ltvSonuc=deger?{gercekLTV:(T/parseFloat(deger))*100,maxLTV:getLTV(parseFloat(deger),enerji)}:null;
    const plan=hesaplaOdemePlani(T,V,ao,bsmvR,kkdfR);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVadeMaliyet=Math.round(aylikTaksit*V*100)/100;
    const azamiKull=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azamiKull);
    const kullAsim=kullOran>azamiKull;
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVadeMaliyet+kullUcret)*100)/100;
    // Efektif yıllık maliyet (bisection)
    const KonutFinansman_taksitBrut = pmt;
    const KonutFinansman_Tnet = T - kullUcret;
    let KonutFinansman_efAylik=0;
    if(KonutFinansman_Tnet>0&&V>0&&KonutFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=KonutFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>KonutFinansman_Tnet)lo=mid;else hi=mid;
      }
      KonutFinansman_efAylik=(lo+hi)/2;
    }
    const KonutFinansman_efYil=KonutFinansman_efAylik>0?Math.round((Math.pow(1+KonutFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:KonutFinansman_efYil,pmt,aylikTaksit,toplamNet,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,ltvSonuc,plan,bsmvR,kkdfR,kullUcret,kullOranUyg,kullAsim,azamiKull};
  },[tutar,vade,oran,tip,deger,enerji,ilkEv,kullKomisyon,s])();


  const degerNum=parseFloat(deger)||0;
  const maxLTV=getLTV(degerNum,enerji);

  return(
    <div style={{padding:"0 16px 32px"}}>
      {showLimits&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:800,color:C.label}}>🏠 Konut Kullandırım Limitleri</span>
              <button onClick={()=>setShowLimits(false)} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"12px 16px 24px"}}>
              {[{baslik:"Ailenin Farklı Bir Konutu MEVCUT DEĞİLSE (İlk Ev)",rows:[
                  {deger:"≤ 5 Milyon ₺",ab:"% 90",c:"% 80",diger:"% 70"},
                  {deger:"5M – 7 Milyon ₺",ab:"% 80",c:"% 70",diger:"% 60"},
                  {deger:"7M – 10 Milyon ₺",ab:"% 70",c:"% 60",diger:"% 50"},
                  {deger:"10M – 20 Milyon ₺",ab:"% 50",c:"% 40",diger:"% 30"},
                  {deger:"> 20 Milyon ₺",ab:"% 40",c:"% 30",diger:"% 20"},
                ]},
                {baslik:"Ailenin Farklı Bir Konutu MEVCUT İSE (İkinci Ev)",rows:[
                  {deger:"≤ 5 Milyon ₺",ab:"% 22,5",c:"% 20",diger:"% 17,5"},
                  {deger:"5M – 7 Milyon ₺",ab:"% 20",c:"% 17,5",diger:"% 15"},
                  {deger:"7M – 10 Milyon ₺",ab:"% 17,5",c:"% 15",diger:"% 12,5"},
                  {deger:"10M – 20 Milyon ₺",ab:"% 12,5",c:"% 10",diger:"% 7,5"},
                  {deger:"> 20 Milyon ₺",ab:"% 10",c:"% 7,5",diger:"% 5"},
                ]},
              ].map((tablo,ti)=>(
                <div key={ti} style={{marginBottom:16}}>
                  <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:ti===0?C.green:C.orange}}>{tablo.baslik}</p>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{background:"#1C3A5E"}}>
                      {["Konut Değeri","A-B Enerji","C Enerji","Diğer"].map((h,i)=>(
                        <th key={i} style={{padding:"5px 6px",color:"#fff",fontWeight:700,textAlign:i>0?"center":"left"}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{tablo.rows.map((r,i)=>(
                      <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.03)":"transparent"}}>
                        <td style={{padding:"5px 6px",fontWeight:600,color:C.label}}>{r.deger}</td>
                        <td style={{padding:"5px 6px",textAlign:"center",color:C.blue,fontWeight:700}}>{r.ab}</td>
                        <td style={{padding:"5px 6px",textAlign:"center",color:C.sub}}>{r.c}</td>
                        <td style={{padding:"5px 6px",textAlign:"center",color:C.sub}}>{r.diger}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={r.bsmvR} kkdfOran={r.kkdfR} onClose={()=>setShowPlan(false)} showKomisyon={r.kullUcret>0} basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)} showCeza={true}/>}
      <Card>
        {/* İlk Ev Toggle */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 12px",background:ilkEv?C.greenLight:"rgba(255,255,255,0.06)",borderRadius:10,border:`1px solid ${ilkEv?C.green:C.border}`}}>
          <div onClick={()=>setIlkEv(!ilkEv)} style={{width:44,height:26,borderRadius:13,background:ilkEv?C.green:"#D1D1D6",position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
            <div style={{position:"absolute",top:3,left:ilkEv?21:3,width:20,height:20,borderRadius:10,background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"left 0.2s"}}/>
          </div>
          <div>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:ilkEv?C.green:C.label}}>{ilkEv?"✅ İlk Evim (Aile Konutu Yok)":"İkinci Ev (Aile Konutu Var)"}</p>
            <p style={{margin:0,fontSize:11,color:C.sub}}>{ilkEv?"BSMV/KKDF yok · Yüksek LTV (Tablo 1)":"BSMV uygulanır · Düşük LTV (Tablo 2)"}</p>
          </div>
        </div>
        <button onClick={()=>setShowLimits(true)} style={{width:"100%",marginBottom:8,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
          <span>📋</span> LTV Limitlerini Görüntüle
        </button>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Konut Değeri (LTV için)" value={deger} onChange={setDeger} suffix="₺"/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        {deger&&<>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:6}}>Enerji Sınıfı</label>
          <Seg options={[{v:"AB",l:"A-B Enerji"},{v:"C",l:"C Enerji"},{v:"diger",l:"Diğer"}]} value={enerji} onChange={setEnerji}/>
          <div style={{background:C.blueLight,borderRadius:10,padding:"10px 12px",marginBottom:4}}>
            <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:700}}>BDDK Azami LTV: %{maxLTV} → Max {fmtTL(degerNum*(maxLTV/100))}</p>
          </div>
        </>}
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        {/* Kredi Kullandırım Komisyonu */}
        <div style={{marginTop:4,marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const V=parseInt(vade)||0;
                const azami=V>0&&V<12?0.50*(V/12):0.50;
                setKullKomisyon(val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azamiKull??AZAMI_KULL_BIR,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5) — Madde 9/2"}
          </p>
          {r?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ Azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>
      {r&&r.ltvAsim&&(
        <div style={{background:"rgba(248,113,113,0.12)",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
          <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ BDDK LTV Sınırı Aşıldı — Hesaplama Yapılamaz</p>
          <p style={{margin:"0 0 2px",fontSize:13,color:C.red}}>Gerçekleşen LTV: %{fmtN(r.gercekLTV)} — Azami: %{r.maxLTV}</p>
          <p style={{margin:0,fontSize:13,color:C.red}}>Kullandırılabilecek azami tutar: {fmtTL(r.maxFin)}</p>
        </div>
      )}
      {r&&!r.ltvAsim&&r.pmt&&<Card>
        <SecTitle>Konut Finansmanı Analizi</SecTitle>
        {ilkEv&&<div style={{background:C.greenLight,borderRadius:8,padding:"7px 10px",marginBottom:8}}>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:700}}>✅ İlk Ev — BSMV ve KKDF uygulanmamaktadır</p>
        </div>}
        <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit||r.pmt)} accent={C.blue} big/>
        <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
        {!ilkEv&&<><RRow label={`BSMV (%${s.bireyselBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
        <RRow label={`KKDF (%${s.bireyselKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/></>}
        {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtTL(r.kullUcret)} accent={C.purple} sub/>}
        <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet||r.toplamNet+r.bsmvTL+r.kkdfTL)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
        {r.ltvSonuc&&<RRow label="LTV" value={`% ${fmtN(r.ltvSonuc.gercekLTV)}`} sub accent={C.green}/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
          <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Konut Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            📅 Ödeme Planı
          </button>
          <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            ⚡ Erken Kapama
          </button>
        </div>
        <RaporButon baslik="Konut Finansmanı Analizi" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit||r.pmt), big:true},
          {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
          {label:`BSMV (%${s.bireyselBSMV})`, value:fmtTL(r.bsmvTL)},
          {label:`KKDF (%${s.bireyselKKDF})`, value:fmtTL(r.kkdfTL)},
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={r.bsmvR||0} kkdfOran={0}/>
      </Card>}
    </div>
  );
}

function TasitFinansman({s,onGecmis}){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [aracDeger,setAracDeger]=useState("");
  const [showLimits,setShowLimits]=useState(false);
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const AZAMI_KULL_BIR=0.50;

  const prevVadeRefT=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRefT.current){
      prevVadeRefT.current=vade;
      const V=parseInt(vade);
      if(V>0){
        const azami=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
        setKullKomisyon(fmtN(azami,4).replace(",","."));
      }
    }
  },[vade]);

  const getTasitLimits=(d)=>{
    const v=parseFloat(d)||0;
    if(v<=400000)  return{ltv:70,vadeMax:48};
    if(v<=800000)  return{ltv:50,vadeMax:36};
    if(v<=1200000) return{ltv:30,vadeMax:24};
    if(v<=2000000) return{ltv:20,vadeMax:12};
    return null; // 2M üzeri kredi verilmez
  };

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    if(!T||!V||!rt||!aracDeger)return null;
    const D=parseFloat(aracDeger);

    // 2M TL üzeri araç kredisi verilmez
    if(D>2000000) return{limitAsim:true,D};

    const lim=getTasitLimits(D);
    if(!lim) return{limitAsim:true,D};

    const gercekLTV=(T/D)*100;
    const maxFin=Math.round(D*(lim.ltv/100));

    // LTV aşımı
    if(T>maxFin) return{ltvAsim:true,maxLTV:lim.ltv,maxFin,gercekLTV,vadeMax:lim.vadeMax,D};
    // Vade aşımı
    if(V>lim.vadeMax) return{vadeAsim:true,vadeMax:lim.vadeMax,maxLTV:lim.ltv,D};

    // Eşit taksit - PMT formülü
    const ao=tip==="yillik"?rt/12/100:rt/100;
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=Math.round(pmt*V*100)/100;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=Math.round(toplamKarPayi*(s.bireyselBSMV/100)*100)/100;
    const kkdfTL=Math.round(toplamKarPayi*(s.bireyselKKDF/100)*100)/100;
    const plan=hesaplaOdemePlani(T,V,ao,s.bireyselBSMV,s.bireyselKKDF);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVadeMaliyet=Math.round(aylikTaksit*V*100)/100;
    const azamiKull=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azamiKull);
    const kullAsim=kullOran>azamiKull;
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVadeMaliyet+kullUcret)*100)/100;
    const ltvSonuc={gercekLTV,maxLTV:lim.ltv,vadeMax:lim.vadeMax};
    // Efektif yıllık maliyet (bisection)
    const TasitFinansman_taksitBrut = pmt;
    const TasitFinansman_Tnet = T - kullUcret;
    let TasitFinansman_efAylik=0;
    if(TasitFinansman_Tnet>0&&V>0&&TasitFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=TasitFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>TasitFinansman_Tnet)lo=mid;else hi=mid;
      }
      TasitFinansman_efAylik=(lo+hi)/2;
    }
    const TasitFinansman_efYil=TasitFinansman_efAylik>0?Math.round((Math.pow(1+TasitFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:TasitFinansman_efYil,pmt,aylikTaksit,toplamNet,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,plan,kullUcret,kullOranUyg,kullAsim,azamiKull,ltvSonuc,D};
  },[tutar,vade,oran,tip,aracDeger,kullKomisyon,s])();


  const D=parseFloat(aracDeger)||0;
  const lim=D>0&&D<=2000000?getTasitLimits(D):null;

  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Taşıt Limit Modal */}
      {showLimits&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:800,color:C.label}}>🚗 Standart Taşıt Kredisi Limitleri</span>
              <button onClick={()=>setShowLimits(false)} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 16px 28px"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead>
                  <tr>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"left"}}>Araç Değeri</th>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"center"}}>Max LTV</th>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"center"}}>Azami Vade</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {aralik:"≤ 400.000 ₺",ltv:"%70",vade:"48 ay",ok:true},
                    {aralik:"400.001 – 800.000 ₺",ltv:"%50",vade:"36 ay",ok:true},
                    {aralik:"800.001 – 1.200.000 ₺",ltv:"%30",vade:"24 ay",ok:true},
                    {aralik:"1.200.001 – 2.000.000 ₺",ltv:"%20",vade:"12 ay",ok:true},
                    {aralik:"≥ 2.000.001 ₺",ltv:"—",vade:"—",ok:false},
                  ].map((row,i)=>(
                    <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.05)"}}>
                      <td style={{padding:"10px 10px",fontSize:12,borderBottom:"1px solid rgba(255,255,255,0.08)",fontWeight:600,color:row.ok?C.label:C.red}}>{row.aralik}</td>
                      <td style={{padding:"10px 10px",fontSize:13,borderBottom:"1px solid rgba(255,255,255,0.08)",fontWeight:800,color:row.ok?C.blue:C.red,textAlign:"center"}}>{row.ltv}</td>
                      <td style={{padding:"10px 10px",fontSize:12,borderBottom:"1px solid rgba(255,255,255,0.08)",fontWeight:700,color:row.ok?C.green:C.red,textAlign:"center"}}>{row.vade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{background:"rgba(248,113,113,0.12)",borderRadius:10,padding:"10px 12px",marginTop:12,border:`1px solid ${C.red}`}}>
                <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>
                  🚫 2.000.001 ₺ ve üzeri araçlar için bireysel amaçlı taşıt kredisi kullandırımı yapılmamaktadır.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF} onClose={()=>setShowPlan(false)} showKomisyon={r.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)}/>}
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Araç Değeri (Zorunlu)" value={aracDeger} onChange={setAracDeger} suffix="₺" hint="BDDK LTV ve azami vade kontrolü için gerekli"/>
        <button onClick={()=>setShowLimits(true)} style={{width:"100%",marginBottom:8,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
          <span>📋</span> Finansman Aralıklarını Görüntüle
        </button>
        {/* Araç değeri bilgi bandı */}
        {D>2000000&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:10,padding:"9px 12px",marginBottom:10,border:`1px solid ${C.red}`}}>
          <p style={{margin:0,fontSize:12,color:C.red,fontWeight:700}}>⛔ 2.000.000 ₺ üzeri araçlara kredi kullandırılamaz</p>
        </div>}
        {D>0&&D<=2000000&&lim&&<div style={{background:C.blueLight,borderRadius:10,padding:"9px 12px",marginBottom:10}}>
          <p style={{margin:"0 0 2px",fontSize:12,color:C.blue,fontWeight:700}}>BDDK Azami LTV: %{lim.ltv} → Max {fmtTL(D*(lim.ltv/100))}</p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>Azami Vade: {lim.vadeMax} Ay</p>
        </div>}
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        {/* Kullandırım Komisyonu */}
        <div style={{marginTop:4,marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const V=parseInt(vade)||0;
                const azami=V>0&&V<12?0.50*(V/12):0.50;
                setKullKomisyon(val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azamiKull??AZAMI_KULL_BIR,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5)"}
          </p>
          {r?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ Azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>

      {/* Uyarılar */}
      {r&&r.limitAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ Kredi Kullandırılamaz</p>
        <p style={{margin:0,fontSize:13,color:C.red}}>Araç değeri 2.000.000 ₺ üzerinde olduğundan taşıt finansmanı kullandırılamaz.</p>
      </div>}
      {r&&r.ltvAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ LTV Sınırı Aşıldı — Hesaplama Yapılamaz</p>
        <p style={{margin:"0 0 2px",fontSize:13,color:C.red}}>LTV: %{fmtN(r.gercekLTV)} (Azami %{r.maxLTV}) → Max Finansman: {fmtTL(r.maxFin)}</p>
      </div>}
      {r&&r.vadeAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ Vade Aşıldı — Hesaplama Yapılamaz</p>
        <p style={{margin:0,fontSize:13,color:C.red}}>Bu araç değeri için azami vade {r.vadeMax} aydır.</p>
      </div>}

      {/* Sonuçlar */}
      {r&&r.pmt&&<Card>
        <SecTitle>Taşıt Finansmanı Analizi</SecTitle>
        <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit)} accent={C.blue} big/>
        <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
        <RRow label={`BSMV (%${s.bireyselBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
        <RRow label={`KKDF (%${s.bireyselKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
        {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtTL(r.kullUcret)} accent={C.purple} sub/>}
        <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet||r.toplamNet+r.bsmvTL+r.kkdfTL)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
          <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Taşıt Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            📅 Ödeme Planı
          </button>
          <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            ⚡ Erken Kapama
          </button>
        </div>
        <RaporButon baslik="Taşıt Finansmanı Analizi" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit), big:true},
          {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
          {label:`BSMV (%${s.bireyselBSMV})`, value:fmtTL(r.bsmvTL)},
          {label:`KKDF (%${s.bireyselKKDF})`, value:fmtTL(r.kkdfTL)},
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF}/>
      </Card>}
    </div>
  );
}


function YatirimFonuFinansman({s,onGecmis}){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const AZAMI_KULL_BIR=0.50;

  const prevVadeRefY=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRefY.current){
      prevVadeRefY.current=vade;
      const V=parseInt(vade);
      if(V>0){
        const azami=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
        setKullKomisyon(fmtN(azami,4).replace(",","."));
      }
    }
  },[vade]);

  const getVadeLimit=(t)=>{
    const v=parseFloat(t)||0;
    if(!v) return null;
    if(v<=125000) return 36;
    if(v<=250000) return 24;
    return 12;
  };

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    if(!T||!V||!rt)return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;
    const lim=getVadeLimit(T);
    if(lim&&V>lim) return{vadeAsim:true,vadeLimit:lim,T};
    const bsmvR=s.bireyselBSMV;
    const kkdfR=s.bireyselKKDF;
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=pmt*V;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=toplamKarPayi*(bsmvR/100);
    const kkdfTL=toplamKarPayi*(kkdfR/100);
    const plan=hesaplaOdemePlani(T,V,ao,bsmvR,kkdfR);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVadeMaliyet=Math.round(aylikTaksit*V*100)/100;
    const azamiKull=V<12?AZAMI_KULL_BIR*(V/12):AZAMI_KULL_BIR;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azamiKull);
    const kullAsim=kullOran>azamiKull;
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVadeMaliyet+kullUcret)*100)/100;
    // Efektif yıllık maliyet (bisection)
    const YatirimFonuFinansman_taksitBrut = pmt;
    const YatirimFonuFinansman_Tnet = T - kullUcret;
    let YatirimFonuFinansman_efAylik=0;
    if(YatirimFonuFinansman_Tnet>0&&V>0&&YatirimFonuFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=YatirimFonuFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>YatirimFonuFinansman_Tnet)lo=mid;else hi=mid;
      }
      YatirimFonuFinansman_efAylik=(lo+hi)/2;
    }
    const YatirimFonuFinansman_efYil=YatirimFonuFinansman_efAylik>0?Math.round((Math.pow(1+YatirimFonuFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:YatirimFonuFinansman_efYil,pmt,aylikTaksit,toplamNet,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,plan,bsmvR,kkdfR,vadeLimit:lim,kullUcret,kullOranUyg,kullAsim,azamiKull};
  },[tutar,vade,oran,tip,kullKomisyon,s])();


  const lim=getVadeLimit(tutar);

  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={r.bsmvR} kkdfOran={r.kkdfR} onClose={()=>setShowPlan(false)} showKomisyon={r.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)}/>}
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        {lim&&<div style={{background:C.blueLight,borderRadius:10,padding:"9px 12px",marginBottom:4}}>
          <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:700}}>
            BDDK Azami Vade: {lim} Ay
          </p>
          <p style={{margin:"3px 0 0",fontSize:11,color:C.sub}}>
            {parseFloat(tutar)<=125000?"≤ 125.000 ₺ → max 36 Ay":parseFloat(tutar)<=250000?"125.001–250.000 ₺ → max 24 Ay":"> 250.000 ₺ → max 12 Ay"}
          </p>
        </div>}
        {/* Kullandırım Komisyonu */}
        <div style={{marginTop:8,marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const V=parseInt(vade)||0;
                const azami=V>0&&V<12?0.50*(V/12):0.50;
                setKullKomisyon(val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azamiKull??AZAMI_KULL_BIR,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5)"}
          </p>
          {r?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ Azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>
      {r&&r.vadeAsim&&(
        <div style={{background:"rgba(248,113,113,0.12)",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
          <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.red}}>⛔ Azami Vade Aşıldı — Hesaplama Yapılamaz</p>
          <p style={{margin:0,fontSize:13,color:C.red}}>Bu tutar için BDDK azami vade {r.vadeLimit} aydır.</p>
        </div>
      )}
      {r&&!r.vadeAsim&&r.pmt&&<Card>
        <SecTitle>Yatırım Fonu Finansmanı</SecTitle>
        <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit)} accent={C.blue} big/>
        <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
        <RRow label={`BSMV (%${r.bsmvR})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
        <RRow label={`KKDF (%${r.kkdfR})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
        <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet||r.toplamNet+r.bsmvTL+r.kkdfTL)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
          <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Yatırım Fonu Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            📅 Ödeme Planı
          </button>
          <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            ⚡ Erken Kapama
          </button>
        </div>
        <RaporButon baslik="Yatırım Fonu Finansmanı" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit), big:true},
          {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
          {label:`BSMV (%${r.bsmvR})`, value:fmtTL(r.bsmvTL)},
          {label:`KKDF (%${r.kkdfR})`, value:fmtTL(r.kkdfTL)},
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF}/>
      </Card>}
    </div>
  );
}



function ToggFinansman({s,onGecmis}){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [aracDeger,setAracDeger]=useState("");
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [showToggLimits,setShowToggLimits]=useState(false);
  const AZAMI=0.50;

  const prevVadeRef=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRef.current){
      prevVadeRef.current=vade;
      const V=parseInt(vade);
      if(V>0) setKullKomisyon(fmtN(V<12?AZAMI*(V/12):AZAMI,4).replace(",","."));
    }
  },[vade]);

  const getLimits=(d)=>{
    const D=parseFloat(d)||0;
    if(D<=0) return null;
    if(D<=2500000)  return{ltv:70,vadeMax:48};
    if(D<=5000000)  return{ltv:50,vadeMax:36};
    if(D<=6500000)  return{ltv:30,vadeMax:24};
    if(D<=7500000)  return{ltv:20,vadeMax:12};
    return{ltv:0,vadeMax:0};
  };

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    // oran en az 1 tam sayı girilmeli (tek haneli bile kabul)
    if(!T||!V||!rt||oran===""||oran.endsWith(".")) return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;
    const D=parseFloat(aracDeger)||0;
    const lim=getLimits(D);
    if(D>0){
      if(!lim||lim.ltv===0) return{ltvAsim:true,limitMesaj:"7.500.000 TL üzeri araçlarda Togg finansmanı uygulanmaz."};
      const maxFin=Math.round(D*(lim.ltv/100));
      if(T>maxFin) return{ltvAsim:true,maxFin,maxLTV:lim.ltv,gercekLTV:(T/D)*100};
      if(V>lim.vadeMax) return{vadeAsim:true,vadeMax:lim.vadeMax};
    }
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=pmt*V;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=toplamKarPayi*(s.bireyselBSMV/100);
    const kkdfTL=toplamKarPayi*(s.bireyselKKDF/100);
    const plan=hesaplaOdemePlani(T,V,ao,s.bireyselBSMV,s.bireyselKKDF);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVade=Math.round(aylikTaksit*V*100)/100;
    const azami=V<12?AZAMI*(V/12):AZAMI;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azami);
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVade+kullUcret)*100)/100;
    const ltvSonuc=D>0&&lim?{gercekLTV:(T/D)*100,maxLTV:lim.ltv}:null;
    // Efektif yıllık maliyet (bisection)
    const ToggFinansman_taksitBrut = pmt;
    const ToggFinansman_Tnet = T - kullUcret;
    let ToggFinansman_efAylik=0;
    if(ToggFinansman_Tnet>0&&V>0&&ToggFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=ToggFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>ToggFinansman_Tnet)lo=mid;else hi=mid;
      }
      ToggFinansman_efAylik=(lo+hi)/2;
    }
    const ToggFinansman_efYil=ToggFinansman_efAylik>0?Math.round((Math.pow(1+ToggFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:ToggFinansman_efYil,aylikTaksit,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,plan,
      kullUcret,kullOranUyg,azami,ltvSonuc};
  },[tutar,vade,oran,tip,aracDeger,kullKomisyon,s])();


  const aracD=parseFloat(aracDeger)||0;
  const limInfo=getLimits(aracD);

  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Togg Limit Tablosu Modal */}
      {showToggLimits&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:800,color:C.label}}>🚗 Togg Finansman Aralıkları</span>
              <button onClick={()=>setShowToggLimits(false)} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 16px 28px"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead>
                  <tr>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"left"}}>Araç Değeri</th>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"center"}}>Max LTV</th>
                    <th style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"#fff",background:"#1C3A5E",textAlign:"center"}}>Azami Vade</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {aralik:"≤ 2.500.000 ₺",ltv:"%70",vade:"48 ay",ok:true},
                    {aralik:"2.500.001 – 5.000.000 ₺",ltv:"%50",vade:"36 ay",ok:true},
                    {aralik:"5.000.001 – 6.500.000 ₺",ltv:"%30",vade:"24 ay",ok:true},
                    {aralik:"6.500.001 – 7.500.000 ₺",ltv:"%20",vade:"12 ay",ok:true},
                    {aralik:"≥ 7.500.001 ₺",ltv:"—",vade:"—",ok:false},
                  ].map((row,i)=>(
                    <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.05)"}}>
                      <td style={{padding:"10px 10px",fontSize:12,borderBottom:"1px solid rgba(255,255,255,0.08)",fontWeight:600,color:row.ok?C.label:C.red}}>{row.aralik}</td>
                      <td style={{padding:"10px 10px",fontSize:13,borderBottom:"1px solid rgba(255,255,255,0.08)",fontWeight:800,color:row.ok?C.blue:C.red,textAlign:"center"}}>{row.ltv}</td>
                      <td style={{padding:"10px 10px",fontSize:12,borderBottom:"1px solid rgba(255,255,255,0.08)",fontWeight:700,color:row.ok?C.green:C.red,textAlign:"center"}}>{row.vade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{background:"rgba(248,113,113,0.12)",borderRadius:10,padding:"10px 12px",marginTop:12,border:`1px solid ${C.red}`}}>
                <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>
                  🚫 7.500.001 ₺ ve üzeri araçlar için bireysel taşıt kredisi kullandırımı yapılmamaktadır.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF} onClose={()=>setShowPlan(false)} showKomisyon={r?.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)}/>}
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Araç Değeri (Zorunlu)" value={aracDeger} onChange={setAracDeger} suffix="₺"
          hint="Togg LTV ve azami vade kontrolü için gerekli"/>
        <button onClick={()=>setShowToggLimits(true)} style={{width:"100%",marginBottom:8,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
          <span>📋</span> Finansman Aralıklarını Görüntüle
        </button>
        {aracD>0&&(aracD>7500000?(
          <div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"8px 12px",marginBottom:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:12,color:C.red,fontWeight:700}}>🚫 7.500.000 TL üzeri araçlarda Togg finansmanı uygulanmaz.</p>
          </div>
        ):limInfo?(
          <div style={{background:C.blueLight,borderRadius:8,padding:"8px 12px",marginBottom:4}}>
            <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:700}}>
              Azami: {fmtTL(Math.round(aracD*(limInfo.ltv/100)))} (%{limInfo.ltv} LTV) · Max {limInfo.vadeMax} ay
            </p>
          </div>
        ):null)}
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const raw=e.target.value;
                const v=parseFloat(raw);
                const V=parseInt(vade)||0;
                const az=V>0&&V<12?AZAMI*(V/12):AZAMI;
                if(!isNaN(v)&&v>az) setKullKomisyon(fmtN(az,4).replace(",","."));
                else setKullKomisyon(raw);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azami??AZAMI,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5)"}
          </p>
        </div>
      </Card>

      {r?.ltvAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:14,padding:"14px 16px",marginBottom:10,border:`1.5px solid ${C.red}`}}>
        {r.limitMesaj
          ? <p style={{margin:0,fontSize:13,color:C.red,fontWeight:700}}>🚫 {r.limitMesaj}</p>
          : <><p style={{margin:"0 0 4px",fontSize:13,color:C.red,fontWeight:800}}>⛔ LTV Sınırı Aşıldı</p>
             <p style={{margin:0,fontSize:12,color:C.red}}>Azami: {fmtTL(r.maxFin)} (%{r.maxLTV} LTV) · Mevcut LTV: %{fmtN(r.gercekLTV)}</p></>}
      </div>}
      {r?.vadeAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:14,padding:"12px 16px",marginBottom:10,border:`1.5px solid ${C.orange}`}}>
        <p style={{margin:0,fontSize:13,color:C.orange,fontWeight:700}}>⛔ Azami vade {r.vadeMax} ay</p>
      </div>}

      {r&&!r.ltvAsim&&!r.vadeAsim&&<>
        <Card>
          <SecTitle>Togg Finansmanı Analizi</SecTitle>
          <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit)} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
          <RRow label={`BSMV (%${s.bireyselBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
          <RRow label={`KKDF (%${s.bireyselKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
          {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtTL(r.kullUcret)} accent={C.purple} sub/>}
          <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
          {r.ltvSonuc&&<RRow label="LTV" value={`% ${fmtN(r.ltvSonuc.gercekLTV)}`} sub accent={C.green}/>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Togg Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>📅 Ödeme Planı</button>
            <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>⚡ Erken Kapama</button>
          </div>
          <RaporButon baslik="Togg Finansmanı Analizi" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
            {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit), big:true},
            {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
            {label:`BSMV (%${s.bireyselBSMV})`, value:fmtTL(r.bsmvTL)},
            {label:`KKDF (%${s.bireyselKKDF})`, value:fmtTL(r.kkdfTL)},
            r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
            {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
            {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={s.bireyselBSMV} kkdfOran={s.bireyselKKDF}/>
        </Card>
      </>}
    </div>
  );
}

function ArsaIsyeriFinansman({s,onGecmis}){
  const [ekspertiz,setEkspertiz]=useState("");
  const [tahsisPct,setTahsisPct]=useState("");
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [showPlan,setShowPlan]=useState(false);
  const [showErken,setShowErken]=useState(false);
  const [kullKomisyon,setKullKomisyon]=useState("0.50");
  const AZAMI=0.50;

  const prevVadeRef=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRef.current){
      prevVadeRef.current=vade;
      const V=parseInt(vade);
      if(V>0) setKullKomisyon(fmtN(V<12?AZAMI*(V/12):AZAMI,4).replace(",","."));
    }
  },[vade]);

  // Tahsis oranı değişince finansman tutarını otomatik doldur
  useEffect(()=>{
    const E=parseFloat(ekspertiz)||0;
    const P=parseFloat(tahsisPct)||0;
    if(E>0&&P>0&&P<=100){
      const hesaplanan=Math.round(E*(P/100));
      setTutar(String(hesaplanan));
    }
  },[ekspertiz,tahsisPct]);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran);
    if(!T||!V||!rt||oran===""||oran.endsWith(".")) return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;
    const bsmvR=s.bireyselBSMV;
    const kkdfR=s.bireyselKKDF;
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamNet=pmt*V;
    const toplamKarPayi=toplamNet-T;
    const bsmvTL=toplamKarPayi*(bsmvR/100);
    const kkdfTL=toplamKarPayi*(kkdfR/100);
    const plan=hesaplaOdemePlani(T,V,ao,bsmvR,kkdfR);
    const aylikTaksit=plan._toplamSabitTaksit||pmt;
    const toplamVade=Math.round(aylikTaksit*V*100)/100;
    const azami=V<12?AZAMI*(V/12):AZAMI;
    const kullOran=parseFloat(kullKomisyon.replace(",","."))||0;
    const kullOranUyg=Math.min(kullOran,azami);
    const kullUcret=kullOran>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0&&plan[0]) plan[0]={...plan[0],komisyon:kullUcret};
    const toplamMaliyet=Math.round((toplamVade+kullUcret)*100)/100;
    // Efektif yıllık maliyet (bisection)
    const ArsaIsyeriFinansman_taksitBrut = pmt;
    const ArsaIsyeriFinansman_Tnet = T - kullUcret;
    let ArsaIsyeriFinansman_efAylik=0;
    if(ArsaIsyeriFinansman_Tnet>0&&V>0&&ArsaIsyeriFinansman_taksitBrut>0){
      let lo=0.0001/12,hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=ArsaIsyeriFinansman_taksitBrut*(1-Math.pow(1+mid,-V))/mid;
        if(pv>ArsaIsyeriFinansman_Tnet)lo=mid;else hi=mid;
      }
      ArsaIsyeriFinansman_efAylik=(lo+hi)/2;
    }
    const ArsaIsyeriFinansman_efYil=ArsaIsyeriFinansman_efAylik>0?Math.round((Math.pow(1+ArsaIsyeriFinansman_efAylik,12)-1)*10000)/100:0;
    return{efektifYillik:ArsaIsyeriFinansman_efYil,aylikTaksit,toplamKarPayi,bsmvTL,kkdfTL,toplamMaliyet,plan,
      kullUcret,kullOranUyg,azami,bsmvR,kkdfR,T,V};
  },[tutar,vade,oran,tip,kullKomisyon,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={r?.bsmvR||0} kkdfOran={r?.kkdfR||0} onClose={()=>setShowPlan(false)} showKomisyon={r?.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik} anaparaTutar={parseFloat(tutar)}/>}
      {showErken&&r?.plan&&<KalanAnaparaModal plan={r.plan} onClose={()=>setShowErken(false)}/>}
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>

        {/* Ekspertiz Değeri */}
        <Field label="Arsa/İşyeri Ekspertiz Değeri (Zorunlu)" value={ekspertiz} onChange={setEkspertiz} suffix="₺"
          hint="Finansman tutarı bu değer üzerinden hesaplanır"/>

        {/* Tahsis Kararı Finansman Yüzdesi */}
        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>
            Tahsis Kararı Finansman Yüzdesi
          </label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={tahsisPct}
              onChange={e=>{
                const v=parseFloat(e.target.value);
                if(isNaN(v)||v>100) return;
                setTahsisPct(e.target.value);
              }}
              placeholder="0"
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>Max %100 · Ekspertiz değeri girildikten sonra finansman tutarı otomatik hesaplanır</p>
        </div>

        {/* Finansman Tutarı - readonly, otomatik */}
        <div style={{marginBottom:13}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Finansman Tutarı</label>
          <div style={{padding:"11px 40px 11px 13px",background:tutar?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.04)",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,fontWeight:600,fontFamily:"monospace",color:tutar?"#F1F5F9":C.sub,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>{tutar?new Intl.NumberFormat("tr-TR").format(parseFloat(tutar)):"Ekspertiz ve % girilince hesaplanır"}</span>
            {tutar&&<span style={{fontSize:13,fontWeight:700,color:C.blue}}>₺</span>}
          </div>
        </div>

        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>

        {/* Kullandırım Komisyonu */}
        <div style={{marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const raw=e.target.value;
                const v=parseFloat(raw);
                const V=parseInt(vade)||0;
                const az=V>0&&V<12?AZAMI*(V/12):AZAMI;
                if(!isNaN(v)&&v>az) setKullKomisyon(fmtN(az,4).replace(",","."));
                else setKullKomisyon(raw);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {vade?`Azami: %${fmtN(r?.azami??AZAMI,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"Bireysel azami %0,50 (binde 5)"}
          </p>
        </div>
      </Card>

      {r&&<Card>
        <SecTitle>Arsa/İşyeri Finansmanı Analizi</SecTitle>
        <RRow label="Aylık Taksit (Sabit)" value={fmtTL(r.aylikTaksit)} accent={C.blue} big/>
        <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
        <RRow label={`BSMV (%${s.bireyselBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
        <RRow label={`KKDF (%${s.bireyselKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
        {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtTL(r.kullUcret)} accent={C.purple} sub/>}
        <RRow label="Toplam Müşteri Maliyeti" value={fmtTL(r.toplamMaliyet)} accent={C.green} big/>
        {r?.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
          <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Arsa/İşyeri Finansmanı",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>📅 Ödeme Planı</button>
          <button onClick={()=>setShowErken(true)} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.orange}`,background:C.orangeLight,color:C.orange,fontWeight:700,fontSize:13,cursor:"pointer"}}>⚡ Erken Kapama</button>
        </div>
        <RaporButon baslik="Arsa/İşyeri Finansmanı" plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:"Ekspertiz Değeri", value:fmtTL(parseFloat(ekspertiz))},
          {label:"Finansman Yüzdesi", value:`%${tahsisPct}`},
          {label:"Finansman Tutarı", value:fmtTL(r.T), big:true},
          {label:"Vade", value:`${r.V} ay`},
          {label:"Aylık Taksit", value:fmtTL(r.aylikTaksit), big:true},
          {label:"Toplam Kâr Payı", value:fmtTL(r.toplamKarPayi)},
          {label:`BSMV (%${s.bireyselBSMV})`, value:fmtTL(r.bsmvTL)},
          {label:`KKDF (%${s.bireyselKKDF})`, value:fmtTL(r.kkdfTL)},
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtTL(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtTL(r.toplamMaliyet), big:true},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={r.bsmvR||0} kkdfOran={r.kkdfR||0}/>
      </Card>}
    </div>
  );
}

function TaksitenKredi({s}){
  const [taksit,  setTaksit]  = useState("");
  const [vade,    setVade]    = useState("");
  const [oran,    setOran]    = useState("");
  const [tip,     setTip]     = useState("aylik");
  const [tur,     setTur]     = useState("bireysel"); // bireysel | tuzel
  const [showPlan,setShowPlan]= useState(false);

  // Vergi oranları kredi türüne göre
  const bsmvOran = tur==="bireysel" ? s.bireyselBSMV : s.ticariBSMV;
  const kkdfOran = tur==="bireysel" ? s.bireyselKKDF : s.ticariKKDF;

  const r = useCallback(()=>{
    const tk = parseFloat(taksit), V = parseInt(vade), rt = parseFloat(oran);
    if(!tk||!V||!rt) return null;

    const ao = tip==="yillik" ? rt/12/100 : rt/100;

    // Taksit içinde BSMV ve KKDF var
    // Brüt taksit = anapara payı + kâr payı + BSMV + KKDF
    // BSMV ve KKDF sadece kâr payı üzerinden alınır
    // Net taksit (sadece anapara + kâr) = brüt taksit / (1 + bsmvOran/100 + kkdfOran/100)
    const vergiCarpan = 1 + bsmvOran/100 + kkdfOran/100;
    const netTaksit = tk / vergiCarpan;

    // Net taksit üzerinden anapara hesapla (ters PMT)
    const anapara = ao===0 ? netTaksit*V : netTaksit*(1-Math.pow(1+ao,-V))/ao;

    const toplamNetOdeme = netTaksit * V;
    const toplamKarPayi  = toplamNetOdeme - anapara;
    const toplamBsmv     = toplamKarPayi * bsmvOran/100;
    const toplamKkdf     = toplamKarPayi * kkdfOran/100;
    const toplamBrutOdeme= tk * V;

    // Ödeme planı
    const plan = hesaplaOdemePlani(anapara, V, ao, bsmvOran, kkdfOran);

    return{
      anapara, netTaksit, toplamNetOdeme,
      toplamKarPayi, toplamBsmv, toplamKkdf,
      toplamBrutOdeme, vergiCarpan,
      girilenTaksit: tk, plan,
    };
  },[taksit,vade,oran,tip,tur,s])();

  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani plan={r.plan} bsmvOran={bsmvOran} kkdfOran={kkdfOran} onClose={()=>setShowPlan(false)}/>}
      <Card>
        <SecTitle>Kredi Türü</SecTitle>
        <Seg options={[{v:"bireysel",l:"Bireysel"},{v:"tuzel",l:"Tüzel/Ticari"}]} value={tur} onChange={setTur}/>
        <div style={{background:C.blueLight,borderRadius:8,padding:"8px 10px",marginBottom:4}}>
          <p style={{margin:0,fontSize:11,color:C.blue}}>
            BSMV: %{fmtN(bsmvOran,0)} — KKDF: %{fmtN(kkdfOran,0)} — Vergi çarpanı: {fmtN(1+bsmvOran/100+kkdfOran/100,4)}x
          </p>
        </div>
      </Card>
      <Card>
        <SecTitle>Parametreler</SecTitle>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Aylık Brüt Taksit Tutarı" value={taksit} onChange={setTaksit} suffix="₺" hint="BSMV ve KKDF dahil ödenen tutar"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
      </Card>

      {r&&<>
        <Card>
          <SecTitle>Finansman Tutarı</SecTitle>
          <RRow label="Kullanılabilir Kredi (Anapara)" value={fmtTL(r.anapara)} accent={C.blue} big/>
          <div style={{height:1,background:C.border,margin:"6px 0"}}/>
          <RRow label="Net Taksit (Vergi Hariç)" value={fmtTL(r.netTaksit)} sub/>
          <RRow label={`BSMV (%${fmtN(bsmvOran,0)}) payı / taksit`} value={fmtTL(r.girilenTaksit - r.netTaksit - r.toplamKarPayi*kkdfOran/100/parseInt(vade||"1"))} sub accent={C.red}/>
          <RRow label={`KKDF (%${fmtN(kkdfOran,0)}) payı / taksit`} value={fmtTL(r.toplamKarPayi*kkdfOran/100/parseInt(vade||"1"))} sub accent={C.red}/>
          <RRow label="Girilen Brüt Taksit" value={fmtTL(r.girilenTaksit)} accent={C.orange}/>
          <div style={{height:1,background:C.border,margin:"6px 0"}}/>
          <RRow label="Toplam Kâr Payı" value={fmtTL(r.toplamKarPayi)}/>
          <RRow label={`Toplam BSMV (%${fmtN(bsmvOran,0)})`} value={fmtTL(r.toplamBsmv)} sub accent={C.red}/>
          <RRow label={`Toplam KKDF (%${fmtN(kkdfOran,0)})`} value={fmtTL(r.toplamKkdf)} sub accent={C.red}/>
          <RRow label="Toplam Brüt Ödeme" value={fmtTL(r.toplamBrutOdeme)} accent={C.green} big/>

          <button onClick={()=>setShowPlan(true)} style={{
            width:"100%",marginTop:12,padding:"12px",borderRadius:12,
            border:`1.5px solid ${C.blue}`,background:C.blueLight,
            color:C.blue,fontWeight:700,fontSize:14,cursor:"pointer"
          }}>
            📅 Ödeme Planını Görüntüle
          </button>
        </Card>

        <RaporButon baslik="Taksitten Tutar Hesaplama" plan={r.plan} satirlar={[
          {label:"Kredi Türü", value:tur==="bireysel"?"Bireysel":"Tüzel/Ticari"},
          {label:"Kullanılabilir Kredi", value:fmtTL(r.anapara), big:true},
          {label:"Girilen Brüt Taksit", value:fmtTL(r.girilenTaksit)},
          {label:`BSMV (%${fmtN(bsmvOran,0)})`, value:fmtTL(r.toplamBsmv)},
          {label:`KKDF (%${fmtN(kkdfOran,0)})`, value:fmtTL(r.toplamKkdf)},
          {label:"Toplam Brüt Ödeme", value:fmtTL(r.toplamBrutOdeme), big:true},
        ]}/>
      </>}
    </div>
  );
}

function SpotKredi({s,onGecmis}){
  const [doviz,setDoviz]=useState("TL");
  const [tutar,setTutar]=useState("");
  const [gun,setGun]=useState("");       // ham giriş (gün sayısı veya tarih)
  const [vadeTip,setVadeTip]=useState("gun"); // "gun" | "tarih"
  const [oran,setOran]=useState("");
  const [kullanımOrani,setKullanımOrani]=useState("1.10");
  const [showPlan,setShowPlan]=useState(false);

  const SABIT_KULLANIRIM = 1.10; // YP'de tavan yok, sabit gelir

  const dovizSembol = doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const fmtDoviz=(n)=>n==null?"—":`${dovizSembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`;

  // Döviz değişince komisyon 1.10'a sıfırla
  useEffect(()=>{ setKullanımOrani("1.10"); },[doviz]);

  // TL: vade DEĞİŞİNCE azami komisyonu doldur (sadece gun değişimi)
  const prevGunRef = useRef("");
  useEffect(()=>{
    if(gun !== prevGunRef.current){
      prevGunRef.current = gun;
      if(doviz==="TL"){
        const G=gunHesapla(gun);
        if(G>0){
          const azami = G<365 ? SABIT_KULLANIRIM*(G/365) : SABIT_KULLANIRIM;
          setKullanımOrani(fmtN(azami,4).replace(",","."));
        }
      }
    }
  },[gun]);

  const gunHesapla=(val)=>{
    if(!val) return 0;
    const s=String(val).trim();
    // GG.AA.YYYY formatı
    if(/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)){
      const [g,a,y]=s.split(".");
      const dt=new Date(parseInt(y),parseInt(a)-1,parseInt(g));
      if(!isNaN(dt.getTime())){
        const today=new Date(); today.setHours(0,0,0,0);
        const diff=Math.round((dt-today)/(1000*60*60*24));
        return diff>0?diff:0;
      }
    }
    // Gün sayısı (sadece rakam)
    if(/^\d+$/.test(s)){
      const n=parseInt(s);
      return isNaN(n)?0:n;
    }
    return 0;
  };

  // Tarih input handler: otomatik nokta ekle GG.AA.YYYY
  const handleTarihInput=(v)=>{
    // Tüm non-digit karakterleri sil
    const digits=String(v).replace(/\D/g,"").slice(0,8);
    let raw=digits;
    if(digits.length>4) raw=digits.slice(0,2)+"."+digits.slice(2,4)+"."+digits.slice(4);
    else if(digits.length>2) raw=digits.slice(0,2)+"."+digits.slice(2);
    setGun(raw);
  };

  const r=useCallback(()=>{
    const T=parseFloat(tutar),G=gunHesapla(gun),rt=parseFloat(oran)/100;
    if(!T||!G||!rt)return null;
    const gunlukOran=rt/365;
    const karPayi=Math.round(T*gunlukOran*G*100)/100;

    // YP'de BSMV/KKDF yok
    const bsmvTL=doviz==="TL"?Math.round(karPayi*(s.ticariBSMV/100)*100)/100:0;
    const kkdfTL=doviz==="TL"?Math.round(karPayi*(s.ticariKKDF/100)*100)/100:0;
    const efektif=gunlukOran*365*100;

    // Komisyon: TL'de oransal tavan, YP'de serbest
    const kullOran = parseFloat(kullanımOrani.replace(",","."))||0;
    let kullAsim=false, kullOranUygulanan=kullOran, azamiKull=null;
    if(doviz==="TL"){
      azamiKull = G<365 ? SABIT_KULLANIRIM*(G/365) : SABIT_KULLANIRIM;
      kullOranUygulanan = Math.min(kullOran, azamiKull);
      kullAsim = kullOran > azamiKull;
    }
    const kullUcret = kullOran>0 ? Math.round(T*(kullOranUygulanan/100)*100)/100 : 0;

    const toplamVadeMaliyet=Math.round((karPayi+bsmvTL+kkdfTL)*100)/100;
    const toplamMaliyet=Math.round((karPayi+bsmvTL+kkdfTL+kullUcret)*100)/100;
    const plan=[{
      ay:1, karPayi, anapara:T,
      vergi:bsmvTL+kkdfTL,
      komisyon:kullUcret,
      toplam:T+toplamVadeMaliyet,
      bakiye:0
    }];
    // Efektif oran komisyon dahil: toplamMaliyet / (T - kullUcret) * (360/G) * 100
    const T_net_spot = T - kullUcret;
    const efektifKomDahil = T_net_spot > 0 && G > 0
      ? Math.round((toplamMaliyet / T_net_spot) * (365/G) * 10000) / 100
      : efektif;
    return{karPayi,bsmvTL,kkdfTL,efektif,efektifKomDahil,gunlukFaiz:T*gunlukOran,T,G,
      kullUcret,kullOranUygulanan,kullAsim,azamiKull,
      toplamMaliyet,plan,doviz};
  },[tutar,gun,oran,kullanımOrani,doviz,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani
        plan={r.plan}
        bsmvOran={doviz==="TL"?s.ticariBSMV:0}
        kkdfOran={doviz==="TL"?s.ticariKKDF:0}
        onClose={()=>setShowPlan(false)}
        showKomisyon={r.kullUcret>0}
        basitOran={r.efektif}
        efektifOran={r.efektifKomDahil}
       anaparaTutar={parseFloat(tutar)}/>}
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        {/* Vade — Gün veya Tarih */}
        <div>
          <div style={{display:"flex",gap:6,marginBottom:4}}>
            <button onClick={()=>{setVadeTip("gun");setGun("");}} style={{flex:1,padding:"6px",borderRadius:8,border:`1.5px solid ${vadeTip==="gun"?C.blue:C.border}`,background:vadeTip==="gun"?C.blueLight:C.card,color:vadeTip==="gun"?C.blue:C.sub,fontWeight:700,fontSize:12,cursor:"pointer"}}>📅 Gün Sayısı</button>
            <button onClick={()=>{setVadeTip("tarih");setGun("");}} style={{flex:1,padding:"6px",borderRadius:8,border:`1.5px solid ${vadeTip==="tarih"?C.blue:C.border}`,background:vadeTip==="tarih"?C.blueLight:C.card,color:vadeTip==="tarih"?C.blue:C.sub,fontWeight:700,fontSize:12,cursor:"pointer"}}>🗓 Vade Tarihi</button>
          </div>
          {vadeTip==="gun"
            ? <Field label="Vade Gün Sayısı" value={gun} onChange={setGun} suffix="Gün" hint={gunHesapla(gun)>0?`${gunHesapla(gun)} gün`:""}/>
            : <div>
                <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:C.blue}}>Vade Tarihi (GG.AA.YYYY)</p>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={gun}
                  onChange={e=>handleTarihInput(e.target.value)}
                  placeholder="21.07.2027"
                  style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",fontSize:17,fontWeight:600,borderRadius:12,border:`1.5px solid ${C.border}`,background:C.card,outline:"none",letterSpacing:2}}
                />
                <p style={{margin:"4px 0 0",fontSize:12,color:gunHesapla(gun)>0?C.green:gun.replace(/\./g,"").length>=8?C.red:C.sub}}>
                  {gunHesapla(gun)>0?`✓ ${gunHesapla(gun)} gün kaldı`:gun.replace(/\./g,"").length>=8?"⚠️ Geçersiz tarih":"Sadece rakam yazın — nokta otomatik eklenir"}
                </p>
              </div>
            }
        </div>
        <Field label="Yıllık Kâr Payı Oranı" value={oran} onChange={setOran} suffix="%"/>
        {/* Kullandırım Oranı */}
        <div style={{marginBottom:4}}>
          <div style={{marginBottom:4}}>
            <label style={{fontSize:12,fontWeight:600,color:C.sub}}>Kredi Kullandırım Komisyonu</label>
          </div>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullanımOrani}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const G=parseInt(gun)||0;
                const azami=G>0&&G<365?SABIT_KULLANIRIM*(G/365):SABIT_KULLANIRIM;
                setKullanımOrani(doviz==="TL"&&val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>

          {r?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>
      {r&&<Card>
        <SecTitle>Spot Finansman Analizi {doviz!=="TL"&&`(${doviz})`}</SecTitle>
        <RRow label={`Toplam Kâr Payı (${gunHesapla(gun)} Gün)`} value={fmtDoviz(r.karPayi)} accent={C.orange} big/>
        {doviz==="TL"&&<>
          <RRow label={`BSMV (%${s.ticariBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
          <RRow label={`KKDF (%${s.ticariKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
          <RRow label="Toplam Kâr Payı Maliyeti" value={fmtTL(r.karPayi+r.bsmvTL+r.kkdfTL)} accent={C.blue} big/>
        </>}
        {r.kullUcret>0&&(
          <RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUygulanan,4)} — peşin)`} value={fmtDoviz(r.kullUcret)} accent={C.purple} sub/>
        )}
        <RRow label="Toplam Müşteri Maliyeti" value={fmtDoviz(r.toplamMaliyet)} accent={C.green} big/>
        <RRow label="Basit Yıllık %" value={`% ${fmtN(r.efektif,2)}`} sub/>
        <RRow label="Efektif Yıllık % (Komisyon Dahil)" value={`% ${fmtN(r.efektifKomDahil,2)}`} sub accent={C.orange}/>
        <div style={{marginTop:8,padding:"12px 14px",background:"rgba(91,155,216,0.12)",borderRadius:12,border:`1.5px solid ${C.blue}`}}>
          <p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,color:C.sub,letterSpacing:"0.04em"}}>TOPLAM GERİ ÖDEME</p>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <p style={{margin:0,fontSize:12,color:C.sub}}>Anapara + Toplam Maliyet</p>
            <p style={{margin:0,fontSize:22,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>{fmtDoviz(parseFloat(tutar)+r.toplamMaliyet)}</p>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <p style={{margin:0,fontSize:10,color:C.sub}}>Anapara: {fmtDoviz(parseFloat(tutar))}</p>
            <p style={{margin:0,fontSize:10,color:C.sub}}>Maliyet: {fmtDoviz(r.toplamMaliyet)}</p>
          </div>
        </div>
        <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Spot Finansman",tutar:fmtTL(parseFloat(tutar)),vade:gunHesapla(gun)+" Gün",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:"-",plan:r?.plan})}} style={{width:"100%",marginTop:12,padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:14,cursor:"pointer"}}>
          📅 Ödeme Planını Görüntüle
        </button>
        <RaporButon baslik={`Spot Finansman Analizi (${doviz})`} plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
          {label:`Finansman Tutarı (${doviz})`, value:fmtDoviz(r.T), big:true},
          {label:"Vade", value:`${r.G} gün`},
          {label:"Günlük Kâr Payı", value:fmtDoviz(r.gunlukFaiz)},
          {label:"Toplam Kâr Payı", value:fmtDoviz(r.karPayi)},
          doviz==="TL"?{label:`BSMV (%${s.ticariBSMV})`, value:fmtTL(r.bsmvTL)}:null,
          doviz==="TL"?{label:`KKDF (%${s.ticariKKDF})`, value:fmtTL(r.kkdfTL)}:null,
          r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUygulanan,4)} — peşin)`, value:fmtDoviz(r.kullUcret)}:null,
          {label:"Toplam Müşteri Maliyeti", value:fmtDoviz(r.toplamMaliyet), big:true},
          {label:"Efektif Yıllık", value:`% ${fmtN(r.efektif)}`},
          {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifKomDahil,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={s.ticariBSMV} kkdfOran={s.ticariKKDF}/>
      </Card>}
    </div>
  );
}


function LTV(){
  const [deger,setDeger]=useState("");const [tip,setTip]=useState("konut");
  const ORANLAR={konut:0.90,tasit:0.70,ticari:0.80};
  const r=useCallback(()=>{
    const D=parseFloat(deger);
    if(!D)return null;
    const oran=ORANLAR[tip];
    return{maxKredi:D*oran,oran:oran*100,minPesinat:D*(1-oran)};
  },[deger,tip])();
  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"konut",l:"Konut"},{v:"tasit",l:"Taşıt"},{v:"ticari",l:"Ticari"}]} value={tip} onChange={setTip}/>
        <Field label="Teminat/Gayrimenkul Değeri" value={deger} onChange={setDeger} suffix="₺"/>
        <div style={{background:C.blueLight,borderRadius:10,padding:"10px 12px",marginTop:4}}>
          <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:600}}>BDDK LTV Oranı: % {ORANLAR[tip]*100}</p>
        </div>
      </Card>
      {r&&<Card>
        <SecTitle>Kullanılabilir Kredi (LTV)</SecTitle>
        <RRow label="Azami Finansman Tutarı" value={fmtTL(r.maxKredi)} accent={C.blue} big/>
        <RRow label="LTV Oranı" value={`% ${fmtN(r.oran,0)}`}/>
        <RRow label="Min. Peşinat" value={fmtTL(r.minPesinat)} accent={C.orange}/>
      </Card>}
    </div>
  );
}

function Leasing({s,onGecmis}){
  const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const SABIT_KULLANIRIM=1.10;

  const [doviz,   setDoviz]   = useState("TL");
  const [tutar,   setTutar]   = useState("");
  const [tutarDisplay, setTutarDisplay] = useState("");
  const [oran,    setOran]    = useState("");
  const [oranTip, setOranTip] = useState("ay");
  const [vade,    setVade]    = useState("");
  const [vadeTip, setVadeTip] = useState("ay");
  const [kdv,     setKdv]     = useState("");
  const [kullKomisyon, setKullKomisyon] = useState("1.10");

  const dovizSembol = doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const fmtDoviz=(n)=>n==null?"—":`${dovizSembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`;

  // Döviz değişince komisyon ve tutar sıfırla
  useEffect(()=>{
    setKullKomisyon("1.10");
    setTutar(""); setTutarDisplay("");
  },[doviz]);

  // TL: vade değişince azami komisyonu doldur
  const prevVadeRef=useRef("");
  useEffect(()=>{
    const vadeStr=`${vade}-${vadeTip}`;
    if(vadeStr!==prevVadeRef.current){
      prevVadeRef.current=vadeStr;
      if(doviz==="TL"){
        const V_raw=parseFloat(vade);
        if(V_raw>0){
          const ayV=vadeTip==="yil"?V_raw*12:V_raw;
          const gunEquiv=ayV*30;
          const azami=gunEquiv<365?SABIT_KULLANIRIM*(gunEquiv/365):SABIT_KULLANIRIM;
          setKullKomisyon(fmtN(azami,4).replace(",","."));
        }
      }
    }
  },[vade,vadeTip]);

  const r = useCallback(()=>{
    const T  = parseFloat(tutar);
    const rt_raw = parseFloat(oran);
    const V_raw  = parseFloat(vade);
    const kdvR   = parseFloat(kdv)||0;
    if(!T||!rt_raw||!V_raw) return null;

    const aoNet = oranTip==="yil" ? rt_raw/100/12 : rt_raw/100;
    const V = vadeTip==="yil" ? Math.round(V_raw*12) : Math.round(V_raw);
    if(V<=0) return null;
    if(V<12) return{vadeAsim:true};

    const pmt_net = aoNet===0 ? T/V : T*aoNet/(1-Math.pow(1+aoNet,-V));

    const now = new Date();
    const plan = [];
    let bakiye = T;
    for(let i=1;i<=V;i++){
      const karPayi = Math.round(bakiye*aoNet*100)/100;
      const anapara = Math.round((pmt_net - karPayi)*100)/100;
      bakiye = Math.max(0, Math.round((bakiye-anapara)*100)/100);
      const tarihAy = (now.getMonth()+i)%12;
      const tarihYil = now.getFullYear()+Math.floor((now.getMonth()+i)/12);
      // KDV = (anapara + kâr payı) × kdvR%
      const kdvTutar = Math.round((anapara + karPayi)*(kdvR/100)*100)/100;
      plan.push({
        ay:i, tarih: MONTHS[tarihAy]+" "+tarihYil,
        taksit: Math.round((pmt_net + kdvTutar)*100)/100,
        anapara, karPayi,
        kdvTutar,
        bakiye
      });
    }

    const toplamKarPayi   = plan.reduce((a,p)=>a+p.karPayi, 0);
    const toplamKdv       = plan.reduce((a,p)=>a+p.kdvTutar, 0);
    const toplamGeriOdeme = plan.reduce((a,p)=>a+p.taksit, 0);
    const yillikMaliyet   = toplamKarPayi + toplamKdv;

    // Komisyon
    const kullOranGiris=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azamiKull=doviz==="TL"?(gunEquiv<365?SABIT_KULLANIRIM*(gunEquiv/365):SABIT_KULLANIRIM):null;
    const kullOranUyg=doviz==="TL"?Math.min(kullOranGiris,azamiKull):kullOranGiris;
    const kullAsim=doviz==="TL"&&kullOranGiris>azamiKull;
    const kullUcret=kullOranGiris>0?Math.round(T*(kullOranUyg/100)*100)/100:0;
    if(kullUcret>0) plan[0]={...plan[0],komisyon:kullUcret};

    const toplamMaliyet=Math.round((toplamGeriOdeme+kullUcret)*100)/100;

    // Efektif yıllık (bisection) - müşteri ödemesi KDV dahil taksit
    const T_netL = T - kullUcret;
    const taksitL = plan[0]?.taksit || pmt_net;
    let efL = 0;
    if(T_netL>0 && V>0 && taksitL>0){
      let lo=0.0001/12, hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=taksitL*(1-Math.pow(1+mid,-V))/mid;
        if(pv>T_netL) lo=mid; else hi=mid;
      }
      efL=(lo+hi)/2;
    }
    const efektifYillik = efL>0 ? Math.round((Math.pow(1+efL,12)-1)*10000)/100 : 0;

    return {
      T, V, rt_raw, oranTip, vadeTip, kdvR,
      pmt_net, pmt_kdv: plan[0]?.taksit||pmt_net,
      toplamKarPayi, toplamKdv, toplamVergi: toplamKdv,
      yillikMaliyet, toplamGeriOdeme, toplamMaliyet,
      kullUcret, kullOranUyg, kullAsim, azamiKull, plan, efektifYillik
    };
  },[tutar,oran,vade,kdv,oranTip,vadeTip,kullKomisyon,doviz])();

  useEffect(()=>{
    if(r?.plan&&r.plan.length>0&&onGecmis){
      onGecmis({modul:"Finansal Kiralama",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.pmt_kdv)});
    }
  // eslint-disable-next-line
  },[!!r?.plan]);



  // ─── SONUÇ + ÖDEME PLANI ─────────────────────────────────────────────────
  const thS = {padding:"10px 12px",fontWeight:700,fontSize:11,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:"left",borderBottom:`2px solid ${C.blue}`,background:C.card};
  const tdS = (color,align="right")=>({padding:"11px 12px",fontSize:13,fontFamily:"monospace",fontWeight:600,color:color||C.label,textAlign:align,borderBottom:`1px solid ${C.border}`});

  return(
    <div style={{padding:"0 16px 40px"}}>
      {/* Form Kartı */}
      <Card>
        {/* Para Birimi */}
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        {/* Finansman Tutarı */}
        <p style={{margin:"0 0 6px",fontSize:12,fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em"}}>Finansman Tutarı</p>
        <div style={{position:"relative",marginBottom:16}}>
          <input inputMode="decimal" value={tutarDisplay}
            onChange={e=>{
              const raw=e.target.value.replace(/\./g,"").replace(/[^0-9,]/g,"");
              const parts=raw.split(",");
              parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,".");
              setTutarDisplay(parts.join(","));
              setTutar(raw.replace(/\./g,"").replace(",","."));
            }}
            placeholder="0"
            style={{width:"100%",boxSizing:"border-box",padding:"11px 44px 11px 14px",fontSize:16,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none"}}/>
          <span style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:14}}>{dovizSembol}</span>
        </div>

        {/* Kâr Oranı */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <p style={{margin:0,fontSize:12,fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em"}}>Kâr Oranı</p>
          <div style={{display:"flex",background:"rgba(255,255,255,0.08)",borderRadius:8,padding:2}}>
            {["ay","yil"].map(t=>(
              <button key={t} onClick={()=>setOranTip(t)} style={{padding:"4px 12px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:oranTip===t?C.blue:"transparent",color:oranTip===t?"#fff":C.sub,transition:"all 0.15s"}}>
                {t==="ay"?"Ay":"Yıl"}
              </button>
            ))}
          </div>
        </div>
        <div style={{position:"relative",marginBottom:16}}>
          <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:14}}>%</span>
          <input inputMode="decimal" value={oran} onChange={e=>setOran(e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,""))}
            placeholder="0"
            style={{width:"100%",boxSizing:"border-box",padding:"11px 14px 11px 32px",fontSize:16,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none"}}/>
        </div>

        {/* Vade */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <p style={{margin:0,fontSize:12,fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em"}}>Vade</p>
          <div style={{display:"flex",background:"rgba(255,255,255,0.08)",borderRadius:8,padding:2}}>
            {["ay","yil"].map(t=>(
              <button key={t} onClick={()=>setVadeTip(t)} style={{padding:"4px 12px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,background:vadeTip===t?C.blue:"transparent",color:vadeTip===t?"#fff":C.sub,transition:"all 0.15s"}}>
                {t==="ay"?"Ay":"Yıl"}
              </button>
            ))}
          </div>
        </div>
        <div style={{position:"relative",marginBottom:16}}>
          <input inputMode="decimal" value={vade} onChange={e=>setVade(e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,""))}
            placeholder="0"
            style={{width:"100%",boxSizing:"border-box",padding:"11px 48px 11px 14px",fontSize:16,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none"}}/>
          <span style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>{vadeTip==="ay"?"Ay":"Yıl"}</span>
        </div>

        {/* KDV */}
        <p style={{margin:"0 0 5px",fontSize:12,fontWeight:600,color:C.sub,textTransform:"uppercase",letterSpacing:"0.05em"}}>KDV Oranı</p>
        <div style={{position:"relative",width:"48%",marginBottom:16}}>
          <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:14}}>%</span>
          <input inputMode="decimal" value={kdv} onChange={e=>setKdv(e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,""))}
            placeholder="0"
            style={{width:"100%",boxSizing:"border-box",padding:"11px 14px 11px 32px",fontSize:16,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none"}}/>
        </div>
        {/* Kullandırım Komisyonu */}
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:5}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{
              const val=parseFloat(e.target.value)||0;
              const V=parseFloat(vade)||0;
              const ayV=vadeTip==="yil"?V*12:V;
              const gunEquiv=ayV*30;
              const azami=gunEquiv>0&&gunEquiv<365?1.10*(gunEquiv/365):1.10;
              setKullKomisyon(doviz==="TL"&&val>azami?fmtN(azami,4).replace(",","."):e.target.value);
            }}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>
          {doviz==="TL"
            ? (vade?`TL azami: %${fmtN(r?.azamiKull??SABIT_KULLANIRIM,4)}${(vadeTip==="ay"?parseFloat(vade):parseFloat(vade)*12)<12?" (oransal)":""} — aşağı revize edilebilir`:"TL — Madde 9/2, oransal tavan")
            : "YP — Tavan yok, serbestçe belirlenebilir (Madde 9/2)"}
        </p>
        {r?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
          <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami %{fmtN(r.azamiKull,4)} uygulandı</p>
        </div>}
      </Card>

      {/* Min vade uyarısı */}
      {r?.vadeAsim&&<div style={{margin:"0 0 12px",background:"rgba(248,113,113,0.12)",borderRadius:14,padding:"14px 16px",border:`1.5px solid ${C.red}`}}>
        <p style={{margin:"0 0 2px",fontSize:14,fontWeight:800,color:C.red}}>⛔ Minimum Vade: 12 Ay</p>
        <p style={{margin:0,fontSize:12,color:C.red}}>Finansal Kiralama'da asgari vade 12 ay (1 yıl)'dır.</p>
      </div>}
      {/* Sonuç - sadece değerler girilince göster */}
      {r&&!r.vadeAsim&&<>
      {/* Özet Kart */}
      <div style={{margin:"0 16px 16px",background:C.card,borderRadius:16,padding:"20px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
        <p style={{margin:"0 0 16px",fontSize:18,fontWeight:800,color:C.label}}>Finansal Kiralama {doviz!=="TL"&&`(${doviz})`}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
          {[
            {l:"FİNANSMAN TÜRÜ",   v:"Finansal Kiralama"},
            {l:"ANAPARA",          v:fmtDoviz(r.T)},
            {l:"VADE",             v:`${r.V} Ay`},
            {l:"ORAN",             v:`%${fmtN(r.rt_raw,2)} ${r.oranTip==="ay"?"Aylık":"Yıllık"}`},
            {l:"KDV",              v:`%${fmtN(r.kdvR,0)}`},
            {l:"AYLIK TAKSİT",     v:fmtDoviz(r.pmt_kdv)},
            {l:"TOPLAM KÂR PAYI",  v:fmtDoviz(r.toplamKarPayi), red:true},
            {l:"TOPLAM KDV",       v:fmtDoviz(r.toplamKdv), red:true},
            {l:"TOPLAM VERGİ",     v:fmtDoviz(r.toplamVergi), red:true},
            {l:"YILLIK MALİYET",   v:fmtDoviz(r.yillikMaliyet), red:true},
            ...(r.kullUcret>0?[{l:"KREDİ KULLANDIRM KOM.",v:fmtDoviz(r.kullUcret),purple:true}]:[]),
          ].map((item,i)=>(
            <div key={i}>
              <p style={{margin:"0 0 2px",fontSize:10,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>{item.l}</p>
              <p style={{margin:0,fontSize:15,fontWeight:800,color:item.purple?C.purple:item.red?C.red:C.label}}>{item.v}</p>
            </div>
          ))}
        </div>
        {/* Toplam Geri Ödeme - tam genişlik */}
        <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <p style={{margin:"0 0 2px",fontSize:10,fontWeight:700,color:C.sub,letterSpacing:"0.06em"}}>TOPLAM MÜŞTERİ MALİYETİ</p>
          <p style={{margin:0,fontSize:26,fontWeight:900,color:C.green,fontFamily:"monospace"}}>{fmtDoviz(r.toplamMaliyet)}</p>
        </div>
        <div style={{padding:"0 2px",marginTop:8}}>
          <RaporButon baslik={`Finansal Kiralama (${doviz})`} plan={r.plan} satirlar={[
            {label:"Finansman Türü", value:"Finansal Kiralama"},
            {label:`Anapara (${doviz})`, value:fmtDoviz(r.T)},
            {label:"Vade", value:`${r.V} Ay`},
            {label:"Oran", value:`%${fmtN(r.rt_raw,2)} ${r.oranTip==="ay"?"Aylık":"Yıllık"}`},
            {label:"KDV", value:`%${fmtN(r.kdvR,0)}`},
            {label:"Aylık Taksit", value:fmtDoviz(r.pmt_kdv), big:true},
            {label:"Toplam Kâr Payı", value:fmtDoviz(r.toplamKarPayi)},
            {label:"Toplam KDV", value:fmtDoviz(r.toplamKdv)},
            r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtDoviz(r.kullUcret)}:null,
            {label:"Toplam Müşteri Maliyeti", value:fmtDoviz(r.toplamMaliyet), big:true},
                                  {label:"Basit Yıllık Oran", value:`% ${fmtN(r?.oranTip==="ay"?(r?.rt_raw||0)*12:(r?.rt_raw||0),2)}`},
                                  {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
                                  ].filter(Boolean)} showKdv={true}/>
        </div>
      </div>

      {/* Ödeme Planı */}
      <div style={{margin:"0 16px",background:C.card,borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>
        <p style={{margin:0,padding:"16px 18px 12px",fontSize:16,fontWeight:800,color:C.label}}>Ödeme Planı</p>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:620}}>
            <thead>
              <tr>
                <th style={{...thS,textAlign:"center",width:36}}>AY</th>
                <th style={thS}>TARİH</th>
                <th style={{...thS,textAlign:"right"}}>TAKSİT</th>
                <th style={{...thS,textAlign:"right"}}>ANAPARA</th>
                <th style={{...thS,textAlign:"right",color:C.red}}>KÂR PAYI</th>
                <th style={{...thS,textAlign:"right",color:C.orange}}>KDV</th>
                <th style={{...thS,textAlign:"right"}}>KALAN ANAPARA</th>
              </tr>
            </thead>
            <tbody>
              {r.plan.map((row,i)=>(
                <tr key={i} style={{background:i%2===0?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.05)"}}>
                  <td style={{...tdS(C.blue,"center"),fontWeight:700}}>{row.ay}</td>
                  <td style={{...tdS(C.label,"left"),fontFamily:"inherit",fontSize:12}}>{row.tarih}</td>
                  <td style={tdS()}>{fmtDoviz(row.taksit)}</td>
                  <td style={tdS(C.sub)}>{fmtDoviz(row.anapara)}</td>
                  <td style={tdS(C.red)}>{fmtDoviz(row.karPayi)}</td>
                  <td style={tdS(C.orange)}>{fmtDoviz(row.kdvTutar)}</td>
                  <td style={tdS(C.sub)}>{fmtDoviz(row.bakiye)}</td>
                </tr>
              ))}
              <tr style={{background:"rgba(91,155,216,0.15)",borderTop:`2px solid ${C.blue}`}}>
                <td colSpan={2} style={{...tdS(C.blue,"left"),fontWeight:800,padding:"12px 12px"}}>TOPLAM</td>
                <td style={{...tdS(),fontWeight:800}}>{fmtDoviz(r.toplamGeriOdeme)}</td>
                <td style={{...tdS(C.sub),fontWeight:800}}>{fmtDoviz(r.T)}</td>
                <td style={{...tdS(C.red),fontWeight:800}}>{fmtDoviz(r.toplamKarPayi)}</td>
                <td style={{...tdS(C.orange),fontWeight:800}}>{fmtDoviz(r.toplamKdv)}</td>
                <td style={{...tdS(C.sub),fontWeight:800}}>{dovizSembol}0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>}
    </div>
  );
}

function TahvilBono({s,onGecmis}){
  const [tip,setTip]=useState("bireysel");
  const [kaydedildiTB,setKaydedildiTB]=useState(false); // bireysel | tuzel
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");       // gün cinsinden
  const [oran,setOran]=useState("");       // yıllık basit oran %

  const r=useCallback(()=>{
    const T=parseFloat(tutar), G=parseInt(vade), rt=parseFloat(oran);
    if(!T||!G||!rt) return null;

    // Dönemsel getiri oranı (basit, gün bazlı)
    const donemselOran = rt/100/365*G;          // dönem brüt oran
    const brutGetiri   = Math.round(T*donemselOran*100)/100;

    // Bireysel: %15 stopaj
    const stopajOran = 15;
    const stopaj = tip==="bireysel" ? Math.round(brutGetiri*(stopajOran/100)*100)/100 : 0;
    const netGetiri = brutGetiri - stopaj;
    const netTutar  = T + netGetiri;

    // Net yıllık oran (bireysel stopaj sonrası)
    const netYillikOran = (netGetiri/T)/G*365*100;

    // Tüzel: mevduat eşlenik oran
    // Mevduat üzerinde stopaj var (%10 varsayılan 365+), sukuk yok
    // Eşlenik = sukukun brüt getirisi ile aynı net getiriyi verecek mevduat oranı
    // net_mevduat = brut_mevduat * (1 - stopaj/100)
    // brut_mevduat = netGetiri/T / G * 365 * 100 / (1 - stopaj/100)
    const stopajMevduat = G<=180 ? s.stopajTL_0_180 : G<=365 ? s.stopajTL_181_365 : s.stopajTL_365plus;
    const eslenikMevduatOran = tip==="tuzel"
      ? (brutGetiri/T)/G*365*100 / (1 - stopajMevduat/100)
      : null;

    // MKK Nakit Ödeme Komisyonu: (anapara + brütGetiri) * 0.0001 + BSMV %0.5 (binde 5)
    const mkkBase  = Math.round((T + brutGetiri) * 0.0001 * 100) / 100;
    const mkkBsmv  = Math.round(mkkBase * 0.05 * 100) / 100;  // BSMV %5
    const mkkTopla = Math.round((mkkBase + mkkBsmv) * 100) / 100;

    // Yıllık bileşik oran
    const yillikBilesik = (Math.pow(1 + donemselOran, 365/G) - 1) * 100;

    return {
      T, G, rt, donemselOran:donemselOran*100,
      brutGetiri, stopaj, netGetiri, netTutar,
      netYillikOran, eslenikMevduatOran, stopajMevduat,
      mkkBase, mkkBsmv, mkkTopla, yillikBilesik
    };
  },[tutar,vade,oran,tip,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"bireysel",l:"Bireysel"},{v:"tuzel",l:"Tüzel"}]} value={tip} onChange={setTip}/>
        <Field label="Yatırım Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Gün)" value={vade} onChange={setVade} suffix="Gün"/>
        <Field label="Yıllık Basit Oran" value={oran} onChange={setOran} suffix="%"/>
      </Card>

      {r&&<Card>
        <SecTitle>Sukuk / Kira Sertifikası Getiri</SecTitle>

        {/* Dönemsel Getiri Oranı */}
        <div style={{background:C.blueLight,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{margin:0,fontSize:12,fontWeight:700,color:C.blue}}>Dönemsel Getiri Oranı ({r.G} gün)</p>
            <p style={{margin:0,fontSize:17,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>% {fmtN(r.donemselOran,4)}</p>
          </div>
        </div>

        <RRow label="Brüt Getiri" value={fmtTL(r.brutGetiri)} accent={C.orange} big/>

        {tip==="bireysel"&&<>
          <RRow label={`Stopaj (%${fmtN(15)})`} value={`- ${fmtTL(r.stopaj)}`} sub accent={C.red}/>
          <RRow label="MKK Nakit Ödeme Komisyonu" value={`- ${fmtTL(r.mkkTopla)}`} sub accent={C.red}/>
          <RRow label="Net Getiri (MKK Sonrası)" value={fmtTL(r.netGetiri - r.mkkTopla)} accent={C.green} big/>
          <RRow label="Vade Sonu Net Tutar" value={fmtTL(r.netTutar - r.mkkTopla)} accent={C.blue} big/>
          <RRow label="Net Yıllık Oran (Basit)" value={`% ${fmtN(r.netYillikOran)}`} sub accent={C.green}/>
          <RRow label={`Yıllık Bileşik Oran (${r.G} gün dönem)`} value={`% ${fmtN(r.yillikBilesik)}`} sub accent={C.teal}/>
        </>}

        {tip==="tuzel"&&<>
          <RRow label="Brüt Yıllık Oran (Basit)" value={`% ${fmtN(r.rt)}`} sub/>
          <RRow label={`Yıllık Bileşik Oran (${r.G} gün dönem)`} value={`% ${fmtN(r.yillikBilesik)}`} sub accent={C.teal}/>
          <RRow label="MKK Nakit Ödeme Komisyonu" value={`- ${fmtTL(r.mkkTopla)}`} sub accent={C.red}/>
          <RRow label="Net Getiri (MKK Sonrası)" value={fmtTL(r.netGetiri - r.mkkTopla)} accent={C.green} big/>
          <RRow label="Vade Sonu Net Tutar" value={fmtTL(r.netTutar - r.mkkTopla)} accent={C.blue} big/>
          {/* Mevduat eşlenik - en altta */}
          <div style={{background:"rgba(167,139,250,0.12)",borderRadius:10,padding:"12px 14px",marginTop:12,border:`1px solid ${C.purple}`}}>
            <p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:"0.06em"}}>
              Mevduat Eşlenik Oran
            </p>
            <p style={{margin:"0 0 6px",fontSize:11,color:C.sub}}>
              Aynı net getiriyi elde etmek için gereken mevduat oranı (stopaj %{fmtN(r.stopajMevduat)} sonrası)
            </p>
            <p style={{margin:"0 0 8px",fontSize:22,fontWeight:900,color:C.purple,fontFamily:"monospace"}}>
              % {fmtN(r.eslenikMevduatOran)}
            </p>
            <div style={{background:"rgba(91,74,138,0.08)",borderRadius:8,padding:"8px 10px",borderLeft:`3px solid ${C.purple}`}}>
              <p style={{margin:0,fontSize:11,color:C.purple,fontWeight:600}}>
                ℹ️ Gelir, kurumsal vergi beyannamesinde beyan edilir. Stopaj uygulanmaz.
              </p>
            </div>
          </div>
        </>}
        {onGecmis&&<button onClick={()=>{onGecmis({modul:"Sukuk Kira Sertifikası",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Gün",oran:oran+"% (Yıllık)",sonuc:fmtTL(r?.brutGetiri),netGetiri:fmtTL(r?.netGetiri),aylikTaksit:"-",plan:[]});setKaydedildiTB(true);setTimeout(()=>setKaydedildiTB(false),2000);}} style={{width:"100%",marginTop:8,padding:"10px",borderRadius:12,border:`1.5px solid ${kaydedildiTB?C.green:C.blue}`,background:kaydedildiTB?C.greenLight:C.blueLight,color:kaydedildiTB?C.green:C.blue,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>
          {kaydedildiTB?"✅ Kaydedildi":"🕐 Geçmişe Kaydet"}
        </button>}
      </Card>}
    </div>
  );
}

// ─── AYARLAR ─────────────────────────────────────────────────────────────────
function Ayarlar({settings,onSave}){
  const [s,setS]=useState({...settings});
  // Allow empty/partial strings while typing; parse on actual save
  const upd=k=>v=>{
    if(v===""||v==="."||v==="-"||/[,.]$/.test(v)){
      setS(p=>({...p,[k]:v}));
    } else {
      const n=parseFloat(String(v).replace(",","."));
      setS(p=>({...p,[k]:isNaN(n)?v:n}));
    }
  };
  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <SecTitle>TL Mevduat Stopaj Oranları</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="0-180 Gün" value={s.stopajTL_0_180} onChange={upd("stopajTL_0_180")} suffix="%"/>
          <Field label="181-365 Gün" value={s.stopajTL_181_365} onChange={upd("stopajTL_181_365")} suffix="%"/>
          <Field label="365+ Gün" value={s.stopajTL_365plus} onChange={upd("stopajTL_365plus")} suffix="%"/>
        </div>
      </Card>
      <Card>
        <SecTitle>YP Mevduat Stopaj</SecTitle>
        <Field label="Tüm Vadeler" value={s.stopajYP_tum} onChange={upd("stopajYP_tum")} suffix="%"/>
      </Card>
      <Card>
        <SecTitle>Kredi Vergi Oranları</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="Bireysel KKDF" value={s.bireyselKKDF} onChange={upd("bireyselKKDF")} suffix="%"/>
          <Field label="Bireysel BSMV" value={s.bireyselBSMV} onChange={upd("bireyselBSMV")} suffix="%"/>
          <Field label="Ticari KKDF" value={s.ticariKKDF} onChange={upd("ticariKKDF")} suffix="%"/>
          <Field label="Ticari BSMV" value={s.ticariBSMV} onChange={upd("ticariBSMV")} suffix="%"/>
        </div>
      </Card>
      <Card>
        <SecTitle>ZK Oranları (Referans)</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="TL Vadesiz/Kısa" value={s.zkTL_vadesiz} onChange={upd("zkTL_vadesiz")} suffix="%"/>
          <Field label="TL 6ay-1yıl" value={s.zkTL_6ay} onChange={upd("zkTL_6ay")} suffix="%"/>
          <Field label="YP Vadesiz" value={s.zkYP_vadesiz} onChange={upd("zkYP_vadesiz")} suffix="%"/>
          <Field label="YP 3ay+" value={s.zkYP_diger} onChange={upd("zkYP_diger")} suffix="%"/>
        </div>
      </Card>
      <Card>
        <SecTitle>Yıllık Fonlama Maliyeti</SecTitle>
        <Field label="Yıllık Fonlama Maliyeti" value={s.fonlamaMaliyeti} onChange={upd("fonlamaMaliyeti")} suffix="% Yıllık"/>
      </Card>
      <Card>
        <SecTitle>POS Referans Oranı (Tebliğ 2020/4)</SecTitle>
        <Field label="Aylık Referans Oran" value={s.referansOran} onChange={upd("referansOran")} suffix="%" hint="Azami %3,11 — MB her ay günceller"/>
        <Field label="BKM Takas (Interchange) Oranı" value={s.bkmTakas} onChange={upd("bkmTakas")} suffix="%" hint="POS hesaplamada kullanılır — BKM talimatına göre güncellenir"/>
        <Field label="Cari Hesap Kâr Payı Oranı (POS)" value={s.cariKarPayiOran} onChange={upd("cariKarPayiOran")} suffix="%" hint="POS analizinde cari hesap getiri hesabı için kullanılır"/>
        <Field label="Katılım Hesabı Kâr Payı Oranı (POS)" value={s.katilimKarPayiOran} onChange={upd("katilimKarPayiOran")} suffix="%" hint="POS analizinde vadeli katılım hesabı getiri hesabı için kullanılır"/>
        <div style={{background:C.blueLight,borderRadius:8,padding:"8px 10px",marginTop:4}}>
          <p style={{margin:0,fontSize:11,color:C.blue}}>Kredi kartı taksitsiz azami = Referans + %0,45 puan | Banka kartı azami = %1,04</p>
        </div>
      </Card>
      <Card>
        <SecTitle>SÖİK — Sevk Öncesi İhracatın Finansmanı (TRY) — Yıllık Kâr Oranı</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="180 Gün / 1 Taksit (Yıllık)" value={s.soikOran_180_1tks} onChange={upd("soikOran_180_1tks")} suffix="%"/>
          <Field label="360 Gün / 4 Taksit (Yıllık)" value={s.soikOran_360_4tks} onChange={upd("soikOran_360_4tks")} suffix="%"/>
          <Field label="540 Gün / 6 Taksit (Yıllık)" value={s.soikOran_540_6tks} onChange={upd("soikOran_540_6tks")} suffix="%"/>
          <Field label="720 Gün / 8 Taksit (Yıllık)" value={s.soikOran_720_8tks} onChange={upd("soikOran_720_8tks")} suffix="%"/>
        </div>
        <div style={{background:C.orangeLight,borderRadius:8,padding:"8px 10px",marginTop:8}}>
          <p style={{margin:0,fontSize:11,color:C.orange}}>Yıllık basit oran, 360 gün baz alınarak azalan bakiye üzerinden taksitlere dağıtılır (BSMV ayrı hesaplanır)</p>
        </div>
      </Card>
      <Card>
        <SecTitle>Reeskont Kredisi (TRY) — TCMB Destekli Eximbank İhracat Finansmanı</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="90 Gün (Yıllık)" value={s.reeskontOran_90} onChange={upd("reeskontOran_90")} suffix="%"/>
          <Field label="180 Gün (Yıllık)" value={s.reeskontOran_180} onChange={upd("reeskontOran_180")} suffix="%"/>
          <Field label="360 Gün (Yıllık)" value={s.reeskontOran_360} onChange={upd("reeskontOran_360")} suffix="%"/>
          <Field label="720 Gün (Yıllık)" value={s.reeskontOran_720} onChange={upd("reeskontOran_720")} suffix="%"/>
        </div>
        <div style={{background:C.orangeLight,borderRadius:8,padding:"8px 10px",marginTop:8}}>
          <p style={{margin:0,fontSize:11,color:C.orange}}>Kâr payı vade başında peşin kesilir. Aracı banka komisyonu (%1 yıllık, gün bazında), kâr kesildikten sonraki net bakiyeden peşin tahsil edilir. Firma bazlı günlük kullanım limiti: 60 Milyon TL. 360 günü aşan vadeler (720 gün) sadece Savunma Sanayi kapsamında faaliyet gösteren firmalara özeldir.</p>
        </div>
      </Card>
      <button onClick={()=>{
          const cleaned=Object.fromEntries(Object.entries(s).map(([k,v])=>[k,isNaN(parseFloat(String(v).replace(",","."))) ? 0 : parseFloat(String(v).replace(",","."))]));
          onSave(cleaned);
        }} style={{width:"100%",padding:"15px",borderRadius:14,border:"none",background:C.blue,color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer"}}>
        Kaydet
      </button>

    </div>
  );
}

// ─── AI ASİSTAN ───────────────────────────────────────────────────────────────
const KB = [
  {
    keys:["tl zk","tl zorunlu","tl mevduat zk","tl mevduat zorunlu","vadesiz zk","vadesiz mevduat","tl katılım zk"],
    title:"TL Zorunlu Karşılık Oranları",
    content:`TL MEVDUAT / KATILIM FONU ZK ORANLARI:
• Vadesiz / İhbarlı / 1 aya kadar / 3 aya kadar: %17
• 6 aya kadar (dahil): %10
• 1 yıla kadar: %10
• 1 yıl ve üzeri: %10
• TCMB kur/fiyat koruma destekli (6 aya kadar): %40
• TCMB kur/fiyat koruma destekli (1 yıl+): %22
• TÜFE/ÜFE/TLREF endeksli değişken faizli hesaplar: %10

TL DİĞER YÜKÜMLÜLÜKLER:
• 1 yıla kadar (dahil): %8
• 3 yıla kadar (dahil): %5,5
• 3 yıldan uzun: %3
• Yurt dışı repo/kredi 1 aya kadar: %20
• Yurt dışı repo/kredi 3 aya kadar: %16
• Yurt dışı repo/kredi ve mevduat 1 yıla kadar: %14
• Ana ortaklığa ait vadesiz yurt dışı banka mevduatı: %0`
  },
  {
    keys:["yp zk","yp zorunlu","yp mevduat zk","döviz zk","yabancı para zk","döviz mevduat zk","yp katılım","makroihtiyati","2026-26","ilave zk","ilave karşılık"],
    title:"YP Zorunlu Karşılık Oranları",
    content:`YP MEVDUAT / KATILIM FONU ZK ORANLARI (17.07.2026'dan itibaren — TCMB 2026-26 sayılı Basın Duyurusu):
• Vadesiz / İhbarlı / 1 aya kadar: %32 (önceki %30)
• 3 ay / 6 ay / 1 yıl / 1 yıl+: %28 (önceki %26)
• İlave ZK (döviz cinsi mevduat/katılım fonu için TL cinsinden ilave zorunlu karşılık): YÜRÜRLÜKTEN KALDIRILDI (01.07.2026 itibarıyla, önceki oran %2,5 idi)

YP DİĞER YÜKÜMLÜLÜKLER:
• 1 yıla kadar (dahil): %21
• 2 yıla kadar (dahil): %10
• 3 yıla kadar (dahil): %8
• 5 yıla kadar (dahil): %3
• 5 yıldan uzun: %0
• Yurt içi yerleşiklerle YP repo (1 yıla kadar): %25

Not: Yeni oranlar üzerinden zorunlu karşılık tesisi 17 Temmuz 2026 tarihinde başlayacaktır.`
  },
  {
    keys:["tl finansman büyüme","tl kredi büyüme","tl büyüme sınır","kobi dışı büyüme","kobi büyüme","ihtiyaç büyüme","taşıt büyüme","tüketici büyüme","tl büyüme limit","tl istisna","tl muaf","tl finansman istisna"],
    title:"TL Finansman Büyüme Sınırları ve İstisnaları",
    content:`TL FİNANSMAN BÜYÜME SINIRI (29.03.2024–31.12.2026):
• KOBİ dışı işletmeler: %2 (iki haftada bir)
• KOBİ işletmeler: %4,5
• Tüketici ihtiyaç finansmanı: %3
• Tüketici taşıt finansmanı: %3

TL İSTİSNA FİNANSMANLAR (büyüme dışı):
✅ Net ihracatçı firmalara ihracat finansmanı (max 2 yıl)
✅ Döviz kazandırıcı hizmet finansmanı (max 2 yıl)
✅ İhracat reeskont finansmanları
✅ Yatırım Teşvik Belgeli yatırım finansmanı (min 2 yıl)
✅ Esnaf finansmanları
✅ Tarımsal finansmanlar
✅ Kamusal amaçlı finansmanlar (5018 sayılı Kanun)
✅ Savunma sanayi firmaları
✅ KOSGEB destekli finansmanlar
✅ Elektrik dağıtım lisanslı firmalar
✅ Başka bankada yeniden yapılandırılan finansmanların kapatılması
✅ Merkez Bankasınca uygun KGF kefaletli programlar`
  },
  {
    keys:["yp finansman büyüme","yp kredi büyüme","yp büyüme sınır","yabancı para büyüme","yp büyüme istisna","yp muaf","yp finansman istisna"],
    title:"YP Finansman Büyüme Sınırı ve İstisnaları",
    content:`YP FİNANSMAN BÜYÜME SINIRI: %0,5 (iki haftada bir)

YP İSTİSNA FİNANSMANLAR (büyüme dışı):
✅ YTB kapsamında makine-teçhizat yatırım finansmanı (min 2 yıl, faturaya bağlı)
✅ Otel yatırımı bina-inşaat finansmanı (min 2 yıl)
✅ Ağır ticari araç finansmanı (min 2 yıl)
✅ Uluslararası kalkınma kuruluşlarından makine-teçhizat finansmanı
✅ Yurt içi bankalara kullandırılan finansmanlar
✅ Gayrikabili rücu akreditif iskontosu (yurt dışı banka riskinde)
✅ Kamusal amaçlı finansmanlar
✅ Savunma sanayi firmaları
✅ KGF kefaletli ihracat finansmanları
✅ Elektrik dağıtım lisanslı firmalar
✅ Başka bankada yeniden yapılandırılan YP finansmanların kapatılması
✅ Hazine garantili kalkınma/yatırım bankası finansmanları
✅ Borç üstlenim anlaşması kapsamı projeler (min 2 yıl)
✅ Özelleştirme ihalesi kazananlara kullandırılan finansmanlar

⚠️ ÖNEMLİ: YP finansmanlarda NET İHRACATÇI muafiyeti YOKTUR.
Bu muafiyet SADECE TL finansmanlarda geçerlidir.`
  },
  {
    keys:["net ihracatçı","ihracat muaf","ihracat finansman muaf","ihracat kredi muaf","net ihracat"],
    title:"Net İhracatçı Firma TL Finansman Muafiyeti",
    content:`NET İHRACATÇI TANIMI:
Son 3 mali yıl VEYA son mali yılda ihracat/ithalat oranı ≥ %110 olan firmalar.
(Yatırım Malları Listesindeki ithalat bedelleri bu hesaba dahil edilmez.)

Net ihracatçılık şartı ARANMAYAN firmalar:
• Savunma sanayi firmaları
• Yüksek teknoloji ihracatı taahhüdü verenler
• Sevk sonrası ihracat finansmanı kullananlar
• İhracat alacak sigortasıyla başvuran yeni kurulan firmalar

UYGULAMA:
• Finansman vadesi en fazla 2 yıl olmalıdır
• Sorumluluk bankaya aittir
• Her yılın 4. ayı sonuna kadar net ihracatçılık güncellenir

⚠️ Bu muafiyet SADECE TL finansmanlarda geçerlidir.
YP finansmanlarda net ihracatçı muafiyeti YOKTUR.`
  },
  {
    keys:["yaptırım","ceza","eksik zk","eksik tesis","cezai faiz","yaptırım nedir"],
    title:"ZK Yaptırımları",
    content:`EKSİK ZK TESİSİNDE YAPTIRIM:
• Eksik TL ZK → 2 katı faizsiz TL bloke mevduat
• Eksik YP ZK → 3 katı faizsiz USD bloke mevduat
• Cezai faiz: TCMB en yüksek gecelik borç verme faizi × 1,50
• Tahakkuk eden cezai faizler ödenmezse 6183 sayılı Kanun'a göre tahsil edilir
• Sürekli ihlal eden kuruluşlara idari tedbirler uygulanır`
  },
  {
    keys:["faiz ödeme","telafi ödeme","zk faiz","karşılık faizi","nema","zk getiri","zk kazanç"],
    title:"ZK Faiz / Telafi Ödemesi",
    content:`TL ZK FAİZ / TELAFİ ÖDEMESİ:
• TL mevduat ZK'sı: TCMB ağırlıklı ort. fonlama maliyeti × 0,86
• Kur/fiyat koruma destekli hesap ZK'sı: TCMB maliyeti × 0,40
• 21 Aralık 2024 sonrası açılan/yenilenen kur koruma hesaplarına bu oran uygulanmaz
• Fazla tesis edilen tutarlara faiz ödenmez
• Ödeme: Her 3 ayda bir (Mart, Haziran, Eylül, Aralık sonu)
• Ödeme, takip eden ilk iş günü serbest mevduat hesabına aktarılır`
  },
  {
    keys:["stopaj","tevkifat","mevduat stopaj","kesinti","stopaj oranı"],
    title:"Mevduat Stopaj Oranları",
    content:`TL MEVDUAT STOPAJ ORANLARI:
• 0 – 180 gün: %17,5
• 181 – 365 gün: %15
• 365 gün üzeri: %10

YP MEVDUAT STOPAJ ORANLARI:
• Tüm vadeler: %25`
  },
  {
    keys:["kkdf","bsmv","vergi oranı","kredi vergi","finansman vergi","kkdf bsmv"],
    title:"KKDF ve BSMV Oranları",
    content:`TİCARİ FİNANSMAN:
• BSMV: %5
• KKDF: %0

BİREYSEL FİNANSMAN:
• BSMV: %15
• KKDF: %15`
  },
  {
    keys:["tesis dönem","hesaplama dönem","bildiri","cetvel","evas","bloke","zk300","tesis süresi"],
    title:"Tesis Dönemi ve Bildirim",
    content:`HESAPLAMA VE TESİS:
• Yükümlülükler: 2 haftada bir Cuma günü itibarıyla hesaplanır
• Tesis başlangıcı: Hesaplama tarihinden 2 hafta sonraki Cuma
• Tesis bitişi: Başlangıcı takip eden Perşembe (14 gün)

BİLDİRİM:
• ZK300H cetveli, EVAS ile öğlen 12:00'ye kadar gönderilir
• Bloke hesap hareketi varsa 1-2 iş günü öncesinde gönderilmesi önerilir

BLOKE ZK ZORUNLULUĞU (31.12.2026'ya kadar):
• Aktif ≥ 500 milyar TL: TL ZK'nın %40'ı bloke
• Aktif ≥ 100 milyar TL: TL ZK'nın %30'u bloke

AKTİF BÜYÜKLÜK İNDİRİMLERİ:
• Aktif < 300 milyar TL: TL ZK'dan 500 milyon TL indirim
• Aktif < 300 milyar TL: YP TL ZK'dan 250 milyon TL indirim`
  },
  {
    keys:["kmh","kredi mevduat","limit büyüme","kmh limit"],
    title:"KMH Limit Büyüme Sınırı (Geçici Madde 17)",
    content:`TÜKETİCİ KMH LİMİT BÜYÜME SINIRI:
• %1 (8 haftada bir hesaplanır)
• 5 milyar TL altı KMH limiti olan bankalar hariçtir
• Geçerlilik: 27.03.2026 – 31.12.2026`
  },
  {
    keys:["erken kapama","erken ödeme","erken ödeme cezası","erken ödeme ücreti","kapama cezası","kredi kapatma","erken kapatma"],
    title:"Erken Ödeme Ücreti (Tebliğ 2020/4 — Madde 11 & Geçici Maddeler)",
    content:`TİCARİ KREDİLERDE ERKEN ÖDEME ÜCRETİ (Tebliğ 2020/4, Madde 11):

▶ 30.06.2024 SONRASI KULLANDIRILAN KREDİLER (Madde 11/3):
• Sabit faizli TL kredi: MB Talimatıyla belirlenen formülle hesaplanan oranda
  (Faiz oranı × kalan ağırlıklı ort. vade bazlı; pratikte azami ~%2)
• Sabit faizli YP/dövize endeksli: Sabit bir oran × kalan ağırlıklı ort. vade (MB Talimatı)
• Değişken faizli (tüm para birimleri): Erken ödenen tutarın azami %2'si

▶ 01.03.2021 – 30.06.2024 ARASI KULLANDIRILAN KREDİLER (Geçici Madde 5/2):
• Kalan vade ≤ 24 ay: %2
• Kalan vade > 24 ay: %2 + her ilave tam yıl için +%1
  (Örn: kalan 36 ay → %2 + %1 = %3; kalan 48 ay → %2 + %2 = %4)
• YP/dövize endeksli: TL oranına +%1 ilave uygulanır

▶ 01.03.2021 ÖNCESİ KULLANDIRILAN KREDİLER (Geçici Madde 5/1):
• Kalan vade ≤ 24 ay: %1
• Kalan vade > 24 ay: %2
• YP/dövize endeksli: +%1 ilave uygulanır

GENEL KURALLAR:
✅ Banka, müşterinin tüm krediyi erken kapatma talebini kabul ETMEK ZORUNDADIR
✅ Erken ödeme anında tahakkuk etmeyen faiz ve diğer maliyetlere ilişkin indirim yapılır
✅ Kısmi erken ödeme de mümkündür; bankadan indirim talep edilebilir
⛔ Bu ücretler sadece erken ödenen tutar üzerinden alınır`
  },
  {
    keys:["kredi tahsis","kullandırım ücreti","tahsis ücreti","kredi ücreti","kredi komisyonu"],
    title:"Kredi Tahsis ve Kullandırım Ücreti (Tebliğ 2020/4 — Madde 9)",
    content:`KREDİ TAHSİS ÜCRETİ (Madde 9/1):
• Azami: Tahsis edilen kredi limitinin %0,20'si
• Yıllık oran; vade ay sayısına oransal uygulanır
• Limit artışında sadece ilave limit üzerinden yeni ücret alınabilir
• Limit talebi müşteriden gelmeden tahsis ücreti alınamaz
• Gayri nakdi krediler dahil tüm kredi limitleri için uygulanır

KREDİ KULLANDIRIMI ÜCRETİ (Madde 9/2):
• Sadece nakdi kredilerden alınır
• Azami: Kullandırılan TL kredinin %1,10'u
• Rotatif kredilerde: Ortalama kullandırım bakiyesi üzerinden yıllık
• Bir yıldan kısa vadeli: Vade gün sayısına oransal düşürülür
• YP kredilerde kullandırım ücreti serbestçe belirlenebilir`
  },
  {
    keys:["teminat","ekspertiz","ipotek ücreti","rehin ücreti","teminat ücreti"],
    title:"Teminatlandırma Ücreti (Tebliğ 2020/4 — Madde 10)",
    content:`TEMİNATLANDIRMA ÜCRETİ (Madde 10):
• Taşınır/taşınmaz rehin ve ipotek tesisleri + ekspertiz işlemleri
• Azami: 3. kişilere ödenen tutarın %15 fazlası
• Hizmet banka bünyesinde sunuluyorsa: Hizmetin makul bedeli`
  },
  {
    keys:["eft ücreti","havale ücreti","fast ücreti","para transferi ücreti","transfer ücreti"],
    title:"Para Transferi Ücretleri (Tebliğ 2020/4 — Madde 15)",
    content:`EFT AZAMİ ÜCRETLERİ (Madde 15 — 06.01.2026 güncel):
≤ 8.300 TL:
  Mobil/İnternet/Düzenli Ödeme: 7,97 TL
  ATM/Kiosk: 27,84 TL
  Diğer kanallar: 39,87 TL

8.300,01 – 399.000 TL:
  Mobil/İnternet/Düzenli Ödeme: 15,96 TL
  ATM/Kiosk: 55,69 TL
  Diğer kanallar: 79,76 TL

399.000 TL Üzeri:
  Mobil/İnternet/Düzenli Ödeme: 199,41 TL
  ATM/Kiosk: 398,83 TL
  Diğer kanallar: 797,68 TL

HAVALE: EFT azami ücretlerinin yarısı
FAST: EFT ile aynı azami limitler
⛔ Hesaptan hesaba işyeri ödemelerinde GÖNDERENden ücret alınamaz`
  },
  {
    keys:["üye işyeri","pos komisyonu","pos ücreti","üye işyeri ücreti","mdm komisyon"],
    title:"Üye İşyeri Ücretleri (Tebliğ 2020/4 — Madde 20)",
    content:`ÜYE İŞYERİ ÜCRETLERİ (Madde 20):
• Kredi kartı taksitsiz (ertesi gün valör): Referans oran + 0,45 puan azami
• Banka kartı (ertesi gün valör): Azami %1,04
• Yurt dışı ihraçlı kartlar: Azami %1,90
• Taksitli işlemler: Taksitsiz ücret + her taksit için en fazla %50 ilave

REFERANS ORAN (Madde 20/A):
• Her ayın sondan 5. iş günü MB tarafından ilan edilir
• Azami: %3,11
• %5'ten fazla değişirse güncellenir

TİCARİ KART KURALLARI (Madde 21):
⛔ Limit aşım ücreti alınamaz
• Nakit avans ücreti: Azami %1
⛔ Ekstre erteleme, taksitlendirme, son ödeme tarihi uzatma ücreti alınamaz
✅ Bankalar ÜCRETSİZ ticari kredi kartı sunmak ZORUNDADIR
• Ek kart yıllık üyelik ücreti: Asıl kartın azami %50'si`
  },
  {
    keys:["ticari ücret tebliğ","2020/4","ticari müşteri ücret","banka ücret tebliğ","ücret bilgilendirme"],
    title:"Tebliğ 2020/4 Genel Çerçeve",
    content:`TİCARİ MÜŞTERİLERDEN ALINABİLECEK ÜCRETLER TEBLİĞİ (2020/4):
Son güncelleme: 31.01.2026 tarihli ve 33154 sayılı RG (2026/5 sayılı Tebliğ)

KAPSAM:
• Mali kuruluşlar dışındaki ticari müşterilere sunulan ürün ve hizmetler
• 4 ana kategori: Ticari Krediler, Dış Ticaret, Nakit Yönetimi, Ödeme Sistemleri

BİLGİLENDİRME KURALLARI (Madde 5 & 7):
• Ücretler internet sitesinde açık ve anlaşılır şekilde ilan edilir
• Ücret artışları en az 2 iş günü önceden bildirilir
• Artışlar geçmişe uygulanamaz

GENEL YASAKLAR:
⛔ Ek-1 dışındaki kategorilerde başka adlarla ücret alınamaz
⛔ Ürün/hizmet sunulamaması halinde (müşterinin vazgeçmesi hariç) iade yapılır
• Paket içindeki ürünlerin toplam ücreti ayrı ayrı azami fiyatları aşamaz`
  },
  {
    keys:["bilgilendirme esası","ücret bildirimi","ilan zorunluluğu","dekont","işlem fişi","sözleşme bilgilendirme","madde 5"],
    title:"Bilgilendirme Esasları (Tebliğ 2020/4 — Madde 5)",
    content:`BİLGİLENDİRME ESASLARI (Madde 5):
• Azami tarifeler bankaların internet sitesinde açık, anlaşılır ve kolay erişilebilir şekilde ilan edilir
• Birlikler ücret bilgilerini toplu olarak kendi internet sitesinde yayımlar
• Azami tarifelerdeki değişiklikler uygulamadan önce MB'ye bildirilir; bildirilen üzeri ücret alınamaz
• Sözleşmelerde bilgilendirme formu zorunludur; form sözleşmenin ayrılmaz parçasıdır
• Hizmet sunulmadan önce müşteriye tahsil edilecek ücret tutarı bildirilmek zorundadır
• Şubede: işlem sonrası dekont veya fişin imzalanması bilgilendirme yükümlülüğünü karşılar
• İşlem fişinde ücret bilgisine açıkça yer verilir
• Fatura/ekstre/sözleşme kopyaları ayrıca ücretlendirilemez (3. kişi maliyetleri hariç)
• Bankalar müşteri onaysız bildirimden ücret alamaz
• İspat yükü bankaya aittir`
  },
  {
    keys:["ücret değişiklik","artış bildirimi","madde 7","ücret artış","tarife güncelleme"],
    title:"Ücretlerin Değiştirilmesi (Tebliğ 2020/4 — Madde 7)",
    content:`ÜCRETLERİN DEĞİŞTİRİLMESİ (Madde 7):
• Ücret artışları uygulamadan en az 2 iş günü önce müşteriye yazılı veya kalıcı veri saklayıcısıyla bildirilir
• Artışlar geçmiş döneme uygulanamaz
• Maktu parasal sınırlar ve azami ücretler her yıl TÜFE oranında MB tarafından artırılır
• 06.01.2026 itibarıyla EFT/Havale/FAST sınırları TÜFE ile güncellenmiştir`
  },
  {
    keys:["dış ticaret","akreditif","ihracat","ithalat","gayri nakdi","madde 12","vesaik","aval"],
    title:"Dış Ticaret Ücretleri (Tebliğ 2020/4 — Madde 12 & Ek-1)",
    content:`DIŞ TİCARET KATEGORİSİ (Madde 12):
• İhracat ve ithalat işlemleri kapsamında sunulan gayri nakdi krediler ve diğer hizmetler

İTHALAT İŞLEMLERİ (Ek-1):
• Akreditif Açılış Ücreti
• Rezerv/Uyuşmazlık Ücreti
• Ön İhbar Ücreti
• Aval/Kabul Ücreti
• Vade/Tutar Değişiklik Ücreti
• Poliçe Kabul Ücreti

İHRACAT İŞLEMLERİ (Ek-1):
• İhbar Ücreti
• Teyit Ücreti
• Vade/Tutar Değişikliği Ücreti
• Vadeli Ödeme Ücreti
• İskonto Ücreti
• Tahsil Ücreti

ORTAK İŞLEMLER (Ek-1):
• Vesaik İnceleme Ücreti
• Değişiklik Ücreti
• İşlem Ücreti
• Muhabir Banka Masrafı
• Ödeme Ücreti

NOT: Dış ticaret kapsamındaki gayri nakdi krediler (akreditif ve banka kabul/avali) ticari krediler kategorisi dışındadır`
  },
  {
    keys:["nakit yönetimi","madde 13","madde 14","hesap açılış","para yatırma","mevduat hesap","atm ücret"],
    title:"Nakit Yönetimi — Hesap ve ATM (Tebliğ 2020/4 — Madde 13-14)",
    content:`NAKİT YÖNETİMİ (Madde 13):
Nakit pozisyon takibi, hesap hizmetleri, para transferleri, ödeme ve tahsilat ürünleri

MEVDUAT/KATILIM FONU HESAPLARI (Madde 14):
⛔ Hesap açılış, işletim, saklama ve bilgi işlem yatırımları için ücret alınamaz
⛔ Para yatırma işlemlerinden (saat 15:30 öncesi şube dahil) ücret alınamaz
  İSTİSNA: Şube kanalıyla 15:30 SONRASI para yatırma ücretlendirilebilir
⛔ Müşterinin kendi bankasının ATM'sinden bakiye sorgulama ve para çekme ücretsizdir
• Başka banka ATM'si: Ödenen tutarın azami %15 fazlası alınabilir`
  },
  {
    keys:["kiralık kasa","madde 16","kasa depozito","kasa ziyaret"],
    title:"Kiralık Kasa (Tebliğ 2020/4 — Madde 16)",
    content:`KİRALIK KASA (Madde 16):
• Sözleşme ile belirlenen hizmetler karşılığında kira ücreti alınabilir
⛔ Kiralık kasa ziyaretinden ücret alınamaz
• Depozito: Bir yıllık kira bedelini aşamaz
• Hizmet sonunda hasar, ödenmemiş kira ve diğer borçlar düşülerek kalan iade edilir`
  },
  {
    keys:["aracılık","fatura tahsilat","madde 17","faturaödeme","gönderen ücret"],
    title:"Aracılık Hizmetleri (Tebliğ 2020/4 — Madde 17)",
    content:`ARACILIK HİZMETLERİ (Madde 17):
⛔ Fatura ve benzeri tahsilatlara aracılık işlemlerinde ÖDEME YAPAN ticari müşteriden ücret alınamaz
✅ Bankalar tahsilatına aracılık yapılan taraftan (alacaklıdan) ücret talep edebilir`
  },
  {
    keys:["belge talep","ekstre","sözleşme kopyası","madde 18","geçmiş evrak"],
    title:"Belge ve Bilgilendirme Ücreti (Tebliğ 2020/4 — Madde 18)",
    content:`BELGE VE BİLGİLENDİRME (Madde 18):
• Sözleşme/fiş/belge kopyası talebi — ilk 1 yıl: Yalnızca 3. kişilere ödenen tutarlar alınabilir
• 1 yılı geçen belge talepleri: Müşteriye bilgi verilerek işlemle orantılı makul ücret alınabilir
• Basılı ekstre: 3. kişilere ödenen tutar kadar (banka bünyesinde: makul bedel)`
  },
  {
    keys:["çek","senet","çek defteri","senet protesto","çek iade","madde 3","çek işlem"],
    title:"Çek ve Senet İşlemleri (Tebliğ 2020/4 — Ek-1)",
    content:`ÇEK İŞLEMLERİ (Ek-1, 3.7):
• Çek Defteri ve Çek Düzenleme Ücreti
• Çek İade Ücreti
• Çek Tahsilatı Ücreti
• Çek Belgelendirme ve Düzeltme İşlemleri Ücreti

SENET İŞLEMLERİ (Ek-1, 3.8):
• Senet Bilgilendirme Ücreti
• Senet İade Ücreti
• Senet Protesto İşlemleri Ücreti
• Senet Tahsile Alma Ücreti`
  },
  {
    keys:["pos ücreti","sanal pos","fiziki pos","kayıp pos","pos donanım","madde 19"],
    title:"POS Ücretleri (Tebliğ 2020/4 — Madde 19 & Ek-1)",
    content:`POS ÜCRETLERİ (Ek-1, 4.1):
• POS Yazılım/Donanım/Bakım Ücreti — Fiziki POS
• POS Yazılım/Donanım/Bakım Ücreti — Sanal POS
• Kayıp/Hasarlı POS ve Aksesuar Bedeli

NOT: Üye işyeri ücreti dışında mal/hizmet tutarı üzerinden başka ücret alınamaz (Madde 20/7)
Üye işyerinin onayıyla kart sahibine aktarılmak üzere alınan ücretler istisnası vardır`
  },
  {
    keys:["tedarikçi finansmanı","dbs","doğrudan borçlandırma","tedarikçi"],
    title:"Tedarikçi Finansmanı ve DBS (Tebliğ 2020/4 — Ek-1)",
    content:`TEDARİKÇİ FİNANSMANI VE DBS (Ek-1, 3.1):
• Tedarikçi Finansmanı ve DBS Ücreti
• Tedarikçi Finansmanı ve DBS Dönem Ücreti

DBS (Doğrudan Borçlandırma Sistemi): Alıcı firmanın onayıyla tedarikçilerin alacaklarının erken tahsili`
  },
  {
    keys:["proje finansman","yapılandırılmış finansman","satın alım birleşme","özelleştirme finansman","madde 8"],
    title:"Ticari Krediler Kapsamı Dışı (Tebliğ 2020/4 — Madde 8/2)",
    content:`TİCARİ KREDİLER KATEGORİSİ DIŞINDA KALAN KREDİLER (Madde 8/2):
Aşağıdakiler için özel sözleşme veya protokol kapsamında kullandırılan krediler ticari krediler kategorisi dışındadır:
• Proje finansmanı
• Satın alım ve birleşme finansmanı
• Özelleştirme finansmanı
• Yapılandırılmış finansman
• Bunların refinansmanı`
  },
];

function normalize(s){
  return (s||"").toLowerCase()
    .replace(/ı/g,"i").replace(/ğ/g,"g").replace(/ş/g,"s")
    .replace(/ç/g,"c").replace(/ö/g,"o").replace(/ü/g,"u");
}

function findAnswer(q){
  const qn=normalize(q);
  const words=qn.split(/\s+/).filter(w=>w.length>2);
  
  let bestScore=0, bestItem=null;
  
  for(const item of KB){
    let score=0;
    for(const key of item.keys){
      const kn=normalize(key);
      // Full phrase match - highest score
      if(qn.includes(kn)) score+=10;
      // Word overlap
      const kwords=kn.split(/\s+/);
      const overlap=words.filter(w=>kwords.some(kw=>kw.includes(w)||w.includes(kw))).length;
      score+=overlap*2;
    }
    if(score>bestScore){bestScore=score;bestItem=item;}
  }
  
  if(bestScore>=4) return bestItem;
  
  // Fallback: single keyword
  for(const item of KB){
    if(item.keys.some(k=>words.some(w=>normalize(k).includes(w)&&w.length>3))){
      return item;
    }
  }
  return null;
}

const MODUL_ICON = {
  "Konut Finansmanı":"🏠","Taşıt Finansmanı":"🚗","Yatırım Fonu Finansmanı":"📦",
  "Togg Finansmanı":"⚡","Arsa/İşyeri Finansmanı":"🏢","Spot Finansman":"💼",
  "Taksitli Ticari Finansman":"🏦","Finansal Kiralama":"📋",
  "Katılım Hesabı Getiri":"💰","Sukuk Kira Sertifikası":"📈",
};

function GecmisPlanModal({plan, baslik}){
  const [open, setOpen] = useState(false);
  const plan_rows = plan.filter(p=>p&&!p._toplamSabitTaksit);
  const fmt=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);

  const metin = [
    baslik + " — Ödeme Planı",
    "---",
    "Ay | Taksit | Kâr Payı | Anapara | Kalan",
    ...plan_rows.map((p,i)=>`${i+1}. ay — ${fmt(p.taksit||p.toplam)} — ${fmt(p.karPayi||p.faiz||0)} — ${fmt(p.anapara||0)} — ${fmt(p.bakiye||0)}`),
    "---",
    "Bu hesaplamalar bilgilendirme amaçlıdır.",
  ].join("\n");

  const kopyala=()=>{
    navigator.clipboard.writeText(metin).catch(()=>{
      const ta=document.createElement("textarea");ta.value=metin;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);
    });
  };

  return(<>
    <div style={{height:1,background:"#2A3A4A",margin:"12px 0"}}/>
    <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid #2A3A4A",background:"#1C2A38",color:"#64748B",fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
      <span>📅</span> Ödeme Planını Görüntüle ({plan_rows.length} taksit)
    </button>

    {open&&(
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end"}}>
        <div style={{background:"#0F1923",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid #2A3A4A",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <span style={{fontSize:14,fontWeight:800,color:"#E2E8F0"}}>📅 {baslik} — Ödeme Planı</span>
            <button onClick={()=>setOpen(false)} style={{background:"#1C2A38",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer",color:"#94A3B8"}}>×</button>
          </div>
          {/* Tablo */}
          <div style={{flex:1,overflowY:"auto",padding:"8px 12px 16px"}}>
            <div style={{display:"grid",gridTemplateColumns:"30px 1fr 1fr 1fr 1fr",background:"#1C3A5E",padding:"7px 8px",borderRadius:"8px 8px 0 0"}}>
              {["Ay","Taksit","Kâr Payı","Anapara","Kalan"].map((h,i)=>(
                <span key={i} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:i>0?"right":"center"}}>{h}</span>
              ))}
            </div>
            {plan_rows.map((p,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"30px 1fr 1fr 1fr 1fr",padding:"6px 8px",background:i%2===0?"#1C2A38":"#162030"}}>
                <span style={{fontSize:9,color:"#64748B",textAlign:"center"}}>{p.ay||i+1}</span>
                {[p.taksit||p.toplam, p.karPayi||p.faiz||0, p.anapara||0, p.bakiye||0].map((v,vi)=>(
                  <span key={vi} style={{fontSize:9,color:"#E2E8F0",textAlign:"right",fontFamily:"monospace"}}>{fmt(v)}</span>
                ))}
              </div>
            ))}
          </div>
          {/* Paylaş */}
          <div style={{padding:"12px 16px",borderTop:"1px solid #2A3A4A",flexShrink:0}}>
            <button onClick={async()=>{
              const blob=new Blob([metin],{type:"text/plain"});
              const file=new File([blob],baslik+".txt",{type:"text/plain"});
              if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
                try{ await navigator.share({title:baslik,text:metin,files:[file]}); return; }catch(e){}
              }
              if(navigator.share){
                try{ await navigator.share({title:baslik,text:metin}); return; }catch(e){}
              }
              kopyala();
            }} style={{width:"100%",padding:"12px",borderRadius:12,border:"none",background:"#2563EB",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <span>⬆️</span> Paylaş
            </button>
            <p style={{margin:"6px 0 0",fontSize:10,color:"#64748B",textAlign:"center"}}>Mail, WhatsApp veya Dosyalar'a kaydedebilirsiniz.</p>
          </div>
        </div>
      </div>
    )}
  </>);
}

function Gecmis({gecmis, onTemizle, nav}){
  const [secili, setSecili] = useState(null);

  if(gecmis.length===0) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"calc(100dvh - 200px)",padding:24,textAlign:"center"}}>
      <p style={{fontSize:48,margin:"0 0 12px"}}>🕐</p>
      <p style={{fontSize:18,fontWeight:800,color:C.label,margin:"0 0 8px"}}>Henüz hesaplama yok</p>
      <p style={{fontSize:14,color:C.sub,margin:0}}>Bir finansman veya getiri hesaplaması yaptığınızda burada görünür.</p>
    </div>
  );

  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Detay Modal */}
      {secili&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:16,fontWeight:800,color:C.label}}>{MODUL_ICON[secili.modul]||"📊"} {secili.modul}</span>
              <button onClick={()=>setSecili(null)} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 18px 28px"}}>
              <p style={{margin:"0 0 14px",fontSize:11,color:C.sub}}>{secili.tarih}</p>
              {[
                {l:"Tutar", v:secili.tutar},
                {l:"Vade", v:secili.vade},
                {l:"Oran", v:secili.oran},
                secili.aylikTaksit!=="-"?{l:"Aylık Taksit", v:secili.aylikTaksit}:null,
                (["Katılım Hesabı Getiri","Sukuk Kira Sertifikası"].includes(secili.modul))&&secili.sonuc?{l:"Brüt Getiri", v:secili.sonuc, big:!secili.netGetiri}:null,
                (["Katılım Hesabı Getiri","Sukuk Kira Sertifikası"].includes(secili.modul))&&secili.netGetiri?{l:"Net Getiri", v:secili.netGetiri, big:true}:null,
                !(["Katılım Hesabı Getiri","Sukuk Kira Sertifikası"].includes(secili.modul))?{l:"Toplam Maliyet", v:secili.sonuc, big:true}:null,
              ].filter(Boolean).map((row,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:13,color:C.sub,fontWeight:600}}>{row.l}</span>
                  <span style={{fontSize:row.big?17:14,fontWeight:row.big?900:700,color:row.big?C.blue:C.label,fontFamily:"monospace"}}>{row.v}</span>
                </div>
              ))}
              {secili.plan&&secili.plan.length>0&&(
                <GecmisPlanModal plan={secili.plan} baslik={secili.modul}/>
              )}
              {/* Paylaş butonu — plan yoksa (Katılım Getiri gibi) */}
              {(!secili.plan||secili.plan.length===0)&&(
                <button onClick={async()=>{
                  const metin=[
                    secili.modul,
                    "Tarih: "+secili.tarih,
                    "---",
                    "Tutar: "+secili.tutar,
                    "Vade: "+secili.vade,
                    "Oran: "+secili.oran,
                    secili.aylikTaksit&&secili.aylikTaksit!=="-"?"Aylık Taksit: "+secili.aylikTaksit:"",
                    secili.sonuc?"Sonuç: "+secili.sonuc:"",
                    secili.netGetiri?"Net Getiri: "+secili.netGetiri:"",
                    "---",
                    "Bu hesaplamalar bilgilendirme amaçlıdır.",
                  ].filter(Boolean).join("\n");
                  if(navigator.share){
                    try{ await navigator.share({title:secili.modul,text:metin}); return; }catch(e){}
                  }
                  navigator.clipboard?.writeText(metin);
                }} style={{width:"100%",marginTop:16,padding:"13px",borderRadius:12,border:"none",background:C.blue,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span>⬆️</span> Paylaş
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div style={{paddingTop:8}}>
        {gecmis.map((g,i)=>(
          <div key={g.id} onClick={()=>setSecili(g)} style={{
            background:C.card, borderRadius:14, padding:"13px 16px", marginBottom:10,
            boxShadow:"0 1px 4px rgba(0,0,0,0.06)", cursor:"pointer",
            borderLeft:`3px solid ${C.blue}`,
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <p style={{margin:"0 0 3px",fontSize:13,fontWeight:800,color:C.label}}>
                  {MODUL_ICON[g.modul]||"📊"} {g.modul}
                </p>
                <p style={{margin:"0 0 6px",fontSize:11,color:C.sub}}>{g.tarih}</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,color:C.sub,background:"rgba(255,255,255,0.05)",borderRadius:6,padding:"2px 7px"}}>{g.tutar}</span>
                  <span style={{fontSize:11,color:C.sub,background:"rgba(255,255,255,0.05)",borderRadius:6,padding:"2px 7px"}}>{g.vade}</span>
                  <span style={{fontSize:11,color:C.sub,background:"rgba(255,255,255,0.05)",borderRadius:6,padding:"2px 7px"}}>{g.oran}</span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <p style={{margin:0,fontSize:11,color:C.sub,marginBottom:2}}>
                  {["Katılım Hesabı Getiri","Sukuk Kira Sertifikası"].includes(g.modul)?"Brüt Getiri":"Toplam"}
                </p>
                <p style={{margin:0,fontSize:14,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>{g.sonuc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Temizle */}
      {gecmis.length>0&&(
        <button onClick={()=>onTemizle()}
          style={{width:"100%",marginTop:8,padding:"12px",borderRadius:12,border:`1.5px solid ${C.red}`,background:"rgba(248,113,113,0.12)",color:C.red,fontWeight:700,fontSize:13,cursor:"pointer"}}>
          🗑 Geçmişi Temizle
        </button>
      )}
    </div>
  );
}

const SOZLUK_KATEGORILER = ["Tümü","Akad & Fıkıh","Finansman Yöntemleri","Hesap Türleri","Menkul Kıymet","Vergi & Kesinti","Bankacılık","Katılım Bankacılığı"];

const SOZLUK_DATA = [
  // ── AKAD & FIKIH ──────────────────────────────────────────────────────────
  {terim:"Akit",tanim:"Hukukî sonuç doğurmak amacıyla iki veya daha fazla tarafın karşılıklı ve birbirine uygun irade beyanlarıyla kurduğu sözleşme. Katılım bankacılığındaki tüm işlemler geçerli bir akde dayanır.",kategori:"Akad & Fıkıh",en:"Contract",ar:"عقد"},
  {terim:"Beyi (Bey')",tanim:"Satış; mal ya da satılabilir bir hakkın bedel karşılığı bir başkasına devredilmesi. Katılım bankacılığının temelini oluşturan meşru kazanç yollarından biridir.",kategori:"Akad & Fıkıh",en:"Sale",ar:"بيع"},
  {terim:"Caiz",tanim:"Meşru, yapılabilir, dinen sakıncasız olan şey. Katılım bankacılığında kullanılan ürün ve sözleşmelerin caiz olması zorunludur.",kategori:"Akad & Fıkıh",en:"Permissible",ar:"جائز"},
  {terim:"Faiz (Riba)",tanim:"Borçtan elde edilen gelir; verilen ödünç paranın üzerine şart koşulan fazlalık. İslamiyet'te borçtan gelir sağlamak yasaklanmıştır; ticaret ise helaldir.",kategori:"Akad & Fıkıh",en:"Interest / Usury",ar:"ربا"},
  {terim:"Garar",tanim:"Belirsizlik hali, bilinmezlik, meçhuliyet. Sözleşmenin konusu veya bedelinin belirsiz olması durumudur. Aşırı garar içeren işlemler İslam hukukunda yasaklanmıştır.",kategori:"Akad & Fıkıh",en:"Uncertainty",ar:"غرر"},
  {terim:"Haram",tanim:"Dinen yasak olan, yapılması kesinlikle uygun görülmeyen iş veya fiil. Faiz içeren, spekülatif ve topluma zararlı işlemler katılım bankacılığında haramdır.",kategori:"Akad & Fıkıh",en:"Prohibited",ar:"حرام"},
  {terim:"Kâr-Zarar Ortaklığı",tanim:"Müşteri ile katılım bankasının belirli bir faaliyetin ya da malın alım-satımından doğacak kâr ve zarara birlikte katılması esasına dayanan finansman modeli.",kategori:"Akad & Fıkıh",en:"Profit-Loss Sharing",ar:"مشاركة في الربح والخسارة"},
  {terim:"Karz",tanim:"Borç, para borcu. Karz işlemi menfaat karşılığı olamaz; borç verilen para yalnızca aynen geri alınabilir, fazlası faiz sayılır.",kategori:"Akad & Fıkıh",en:"Loan",ar:"قرض"},
  {terim:"Karz-ı Hasen",tanim:"Faizsiz borç verme; verilen ödünçten hiçbir fazlalık talep etmeme. Yalnızca anapara geri alınır. Enflasyon farkı talep etmek meşru kabul edilmektedir.",kategori:"Akad & Fıkıh",en:"Benevolent Loan",ar:"قرض حسن"},
  {terim:"Kabz",tanim:"Teslim almak; satın alınan malı fiilen ya da hükmen ele geçirmek. Gerçek kabz malın bizzat alınmasıdır. Hükmi kabz ise mal üzerinde tasarruf hakkının elde edilmesidir.",kategori:"Akad & Fıkıh",en:"Possession / Delivery",ar:"قبض"},
  {terim:"Vekâlet",tanim:"Bir kişinin başkası adına işlem yapmasına olanak tanıyan yetki devri sözleşmesi. Katılım bankalarında yatırım hesapları ve dış ticaret işlemlerinde yaygın kullanılır.",kategori:"Akad & Fıkıh",en:"Agency",ar:"وكالة"},
  {terim:"Kefalet",tanim:"Bir borcun ya da yükümlülüğün ifa edileceğine dair güvence verme; kefil olma. Teminat mektuplarının İslam hukukundaki karşılığıdır.",kategori:"Akad & Fıkıh",en:"Guarantee / Surety",ar:"كفالة"},
  {terim:"İne Satışı",tanim:"Peşin bedelle satılan bir malın vadeli bedelle geri alınması. Faiz hilesine yol açtığı gerekçesiyle İslam alimlerinin çoğunluğunca meşru görülmemektedir.",kategori:"Akad & Fıkıh",en:"Bay al-Inah",ar:"بيع العينة"},
  {terim:"İcma",tanim:"İslam müçtehitlerinin belirli bir dönemde pratik bir meselenin dinî hükmü üzerinde görüş birliğine varması. Katılım bankacılığı ürünleri bu ilkeye dayanılarak geliştirilmektedir.",kategori:"Akad & Fıkıh",en:"Scholarly Consensus",ar:"إجماع"},

  // ── FİNANSMAN YÖNTEMLERİ ────────────────────────────────────────────────
  {terim:"Murabaha",tanim:"Katılım bankasının müşteri adına satın aldığı mal veya hizmeti, maliyet üzerine önceden belirlenen bir kâr marjı ekleyerek vadeli satması. Türkiye'de kurumsal finansman desteği olarak uygulanır.",kategori:"Finansman Yöntemleri",en:"Cost-Plus Financing",ar:"مرابحة"},
  {terim:"Mudaraba",tanim:"Bir tarafın sermaye (rab-ül-mal), diğer tarafın emek ve yönetimi (mudarip) ortaya koyduğu ortaklık. Kâr önceden belirlenen oranla paylaşılır; zarar yalnızca sermayeye yüklenir.",kategori:"Finansman Yöntemleri",en:"Profit-Sharing Investment",ar:"مضاربة"},
  {terim:"Müşaraka",tanim:"Her iki tarafın hem sermaye hem de yönetime katıldığı ortaklık modeli. Kâr ve zarar, katılım oranlarına göre paylaşılır. Azalan müşaraka konut finansmanında kullanılır.",kategori:"Finansman Yöntemleri",en:"Partnership / Equity Participation",ar:"مشاركة"},
  {terim:"İcara (Leasing)",tanim:"Banka varlığı satın alır, müşteriye belirli bir kira bedeli karşılığında kullandırır. Vade sonunda mülkiyet devredilebilir. Türkiye'de finansal kiralama adıyla uygulanmaktadır.",kategori:"Finansman Yöntemleri",en:"Leasing",ar:"إجارة"},
  {terim:"Selem",tanim:"Ürünün teslimi gelecekte yapılmak üzere bedelin peşin ödendiği satış sözleşmesi. Tarımsal ürünler ve standart malların finansmanında kullanılır.",kategori:"Finansman Yöntemleri",en:"Forward Sale",ar:"سلم"},
  {terim:"İstisna",tanim:"Henüz üretilmemiş ya da inşa edilmemiş bir mal/projenin sipariş üzerine finansmanını kapsayan sözleşme. İnşaat, imalat ve altyapı projelerinde yaygın kullanılır.",kategori:"Finansman Yöntemleri",en:"Manufacturing Finance",ar:"استصناع"},
  {terim:"Teverruk",tanim:"Nakit ihtiyacı için kullanılan; bankanın vadeli sattığı bir malın müşteri tarafından spot piyasada üçüncü kişiye satılmasına dayanan işlem. Fıkıh çevrelerinde tartışmalıdır.",kategori:"Finansman Yöntemleri",en:"Commodity Murabaha",ar:"تورق"},
  {terim:"Azalan Müşaraka",tanim:"Bankanın zamanla azalan ortaklık payını müşteriye devrettiği; konut finansmanında kullanılan azalan ortaklık modeli. Müşteri taksit ödedikçe bankanın payı küçülür.",kategori:"Finansman Yöntemleri",en:"Diminishing Musharaka",ar:"المشاركة المتناقصة"},
  {terim:"İsticrar",tanim:"Alıcının belirli bir malı satıcıdan belirli periyotlarla satın almayı taahhüt ettiği açık hesaplı sürekli tedarik sözleşmesi. Bankacılık Yönetmeliği'nde 'açık hesaplı satım' olarak tanımlanmış olup özellikle tüketim malları ve hammadde gibi defalarca teslim gerektiren ürünlerin finansmanında; müşterinin malı alır almaz tükettiği durumlarda murabaha yerine uygulanır. TKBB Strateji Belgesi'nde 'belirli bir malın alıcı tarafından satıcıya belirli zamanlarda alınacağının vaat edilmesini konu alan sözleşme türü' şeklinde tanımlanmıştır.",kategori:"Finansman Yöntemleri",en:"Open Account / Continuous Purchase",ar:"استجرار"},
  {terim:"Yatırım Vekâleti",tanim:"Fon sahibinin (müvekkil) fonunu İslami kurallara uygun yatırım ve ticari faaliyetlerde değerlendirmek amacıyla bankayı (vekil) yetkili kıldığı acentelik sözleşmesi. Uluslararası literatürde 'Wakala bi'l-İstismar' olarak anılır. Bankacılık Yönetmeliği'nde vekâlet yöntemleri kapsamında düzenlenmiş; kârın tamamı veya önceden belirlenmiş bir kısmı ile zarar bankaya aittir. Banka belirlenen vekâlet ücreti karşılığında meşru enstrümanlara yatırım yapar; sermaye ve kâr garantisi veremez. Türkiye'de başta yurt dışı kaynaklı kısa vadeli fon temini amacıyla kullanılmakta, mudarabeli katılma hesaplarından ayrı havuzlarda işletilmektedir.",kategori:"Finansman Yöntemleri",en:"Investment Agency (Wakala)",ar:"الوكالة بالاستثمار"},

  // ── HESAP TÜRLERİ ────────────────────────────────────────────────────────
  {terim:"Katılım Hesabı (Katılma Hesabı)",tanim:"Katılım bankasına yatırılan fonların kâr/zarar ortaklığı esasına göre değerlendirildiği hesap. Vade sonunda getiri garantisi yoktur; banka kâr etmişse pay dağıtılır.",kategori:"Hesap Türleri",en:"Participation Account",ar:"حساب المشاركة"},
  {terim:"Özel Cari Hesap",tanim:"İstenildiğinde kısmen veya tamamen çekilebilen, karşılığında herhangi bir getiri ödenmeyen hesap türü. Vadesiz hesabın katılım bankacılığındaki karşılığıdır.",kategori:"Hesap Türleri",en:"Current Account",ar:"حساب جاري"},
  {terim:"Vadeli Katılım Hesabı",tanim:"Belirli bir süre için bankaya yatırılan ve vade sonunda kâr payıyla birlikte geri alınan hesap. Vade seçenekleri 1 ay ile 5 yıl arasında değişir.",kategori:"Hesap Türleri",en:"Term Deposit Account",ar:"حساب الودائع الآجلة"},
  {terim:"Günlük Hesap",tanim:"Her gün değerleme yapılan, istenildiğinde çekilebilen ve günlük kâr payı işleyen hesap türü. Belirli bir bakiyenin cari bloke olarak ayrılması gerekmektedir.",kategori:"Hesap Türleri",en:"Daily Account",ar:"حساب يومي"},
  {terim:"Birim Değeri",tanim:"Katılma hesabının izlendiği endeks değeri. İlk açılışta 100 kabul edilir; kâr edildiğinde yükselir, zarar edildiğinde düşer. Vade sonundaki getiriyi hesaplamada kullanılır.",kategori:"Hesap Türleri",en:"Unit Value",ar:"القيمة الوحدوية"},
  {terim:"Birim Hesap Değeri",tanim:"Katılım hesabının cari değerini gösteren tutar. Birim Değeri × Hesap Değeri formülüyle hesaplanır. Müşterinin o an itibarıyla hak iddia edebileceği meblağdır.",kategori:"Hesap Türleri",en:"Unit Account Value",ar:"قيمة حساب الوحدة"},
  {terim:"Cari Bloke",tanim:"Günlük hesap açılışında belirlenen bakiye bandına göre hesapta bloke tutulan zorunlu tutar. Bu tutar üzerinden getiri hesaplanmaz; yalnızca nakde hazır tutar olarak bekletilir.",kategori:"Hesap Türleri",en:"Current Block",ar:"رصيد محجوز"},
  {terim:"Kâr Payı",tanim:"Katılım bankacılığında yatırımın getirisini ifade eden pay. Banka, topladığı fonları meşru ticaret ve ortaklık yöntemleriyle değerlendirir; elde ettiği kârı belirlenen paylaşım oranıyla hesap sahiplerine dağıtır.",kategori:"Hesap Türleri",en:"Profit Share",ar:"نصيب الربح"},
  {terim:"Standart Oran (85/15)",tanim:"Katılım hesaplarında banka ile müşteri arasındaki kâr paylaşım oranı. 85/15; toplam kârın %85'inin müşteriye, %15'inin bankaya ait olduğunu ifade eder.",kategori:"Hesap Türleri",en:"Distribution Ratio",ar:"نسبة التوزيع"},
  {terim:"Katılım Fonu",tanim:"Katılım bankasındaki özel cari ve katılma hesaplarında bulunan toplam para. Bu fonların faizsiz enstrümanlarla değerlendirilmesi zorunludur.",kategori:"Hesap Türleri",en:"Participation Fund",ar:"صندوق المشاركة"},

  // ── MENKUL KIYMET ────────────────────────────────────────────────────────
  {terim:"Sukuk (Kira Sertifikası)",tanim:"Varlığa dayalı İslami finansal araç. Belirli bir varlığın mülkiyetine ya da kira gelirine ortak olmayı sağlar. Getiri, borç ilişkisinden değil; varlıktan elde edilen kira veya kârdan kaynaklanır. Türkiye'de hazine ve özel sektör sukuku ihraç edilmektedir.",kategori:"Menkul Kıymet",en:"Sukuk / Islamic Bond",ar:"صكوك"},
  {terim:"İcara Sukuku",tanim:"Kira gelirine dayanan ve en yaygın kullanılan sukuk türü. Türkiye'de 'kira sertifikası' adıyla bilinen sukuk türü esasen bu yapıdadır. Sabit kira geliri sağlar.",kategori:"Menkul Kıymet",en:"Lease-Based Sukuk",ar:"صكوك الإجارة"},
  {terim:"Katılım Yatırım Fonu",tanim:"Katılım finans ilkelerine uygun hisse senedi, kira sertifikası ve altın gibi araçlara yatırım yapan fon. BDDK ve SPK denetiminde faaliyet gösterir.",kategori:"Menkul Kıymet",en:"Participation Investment Fund",ar:"صندوق الاستثمار المشترك"},
  {terim:"Katılım Endeksi (KATLM)",tanim:"BİST'te işlem gören ve katılım bankacılığı prensiplerine uygun hisse senetlerinden oluşan borsa endeksi. Alkol, faiz ve şans oyunlarına bağlı şirketler dışlanır.",kategori:"Menkul Kıymet",en:"Participation Index",ar:"مؤشر المشاركة"},
  {terim:"Tekafül",tanim:"İslam hukukuna uygun sigorta sistemi. Katılımcıların belirledikleri bir havuza prim yatırarak risklere karşı birbirini güvence altına alması esasına dayanır.",kategori:"Menkul Kıymet",en:"Islamic Insurance",ar:"تكافل"},

  // ── VERGİ & KESİNTİ ──────────────────────────────────────────────────────
  {terim:"BSMV (Banka ve Sigorta Muameleleri Vergisi)",tanim:"Bankaların finansal işlemleri üzerinden alınan vergi. Bireysel kredilerin kâr payı üzerinden %15 oranında uygulanır. Kurumsal işlemlerde de geçerlidir.",kategori:"Vergi & Kesinti",en:"Banking and Insurance Transaction Tax",ar:"ضريبة معاملات البنوك والتأمين"},
  {terim:"KKDF (Kaynak Kullanımı Destekleme Fonu)",tanim:"Bireysel tüketici kredilerinden yapılan kesinti. Konut ve taşıt kredilerinde oran sıfır iken diğer bireysel kredilerde %15 oranında uygulanır.",kategori:"Vergi & Kesinti",en:"Resource Utilization Support Fund",ar:"صندوق دعم استخدام الموارد"},
  {terim:"Stopaj (Gelir Vergisi Tevkifatı)",tanim:"Yatırım gelirlerinden kaynakta kesilen vergi. Bireysel katılım hesapları için vadeye göre %0 ile %17,5 arasında uygulanır. Tüzel kişilerde stopaj uygulanmaz.",kategori:"Vergi & Kesinti",en:"Withholding Tax",ar:"ضريبة الاستقطاع"},
  {terim:"KDV (Katma Değer Vergisi)",tanim:"Finansal kiralama işlemlerinde varlığın türüne göre uygulanan vergi. Taşınmaz kiralamasında %1, taşınabilir varlıklarda farklı oranlar geçerli olabilir.",kategori:"Vergi & Kesinti",en:"Value Added Tax",ar:"ضريبة القيمة المضافة"},

  // ── BANKACILIK ───────────────────────────────────────────────────────────
  {terim:"LTV (Loan to Value / Finansman-Değer Oranı)",tanim:"Finansman tutarının teminat değerine oranı. %70 LTV, 1.000.000 TL değerli bir varlık için en fazla 700.000 TL finansman kullandırılabileceği anlamına gelir. BDDK tarafından sınırlıdır.",kategori:"Bankacılık",en:"Loan to Value Ratio",ar:"نسبة القرض إلى القيمة"},
  {terim:"ZK (Zorunlu Karşılık)",tanim:"Bankaların mevduatlarına karşılık TCMB'de bloke tutmak zorunda olduğu fon. Bu fonlar bankalar tarafından kullanılamaz; efektif getiri oranını ve maliyet hesaplamalarını etkiler.",kategori:"Bankacılık",en:"Reserve Requirement",ar:"الاحتياطي الإلزامي"},
  {terim:"Ekspertiz Değeri",tanim:"Bağımsız uzman tarafından belirlenen taşınmaz veya araç değeri. LTV hesaplamalarında esas alınır; piyasa değerinden farklı olabilir.",kategori:"Bankacılık",en:"Appraisal Value",ar:"قيمة التقييم"},
  {terim:"BDDK (Bankacılık Düzenleme ve Denetleme Kurumu)",tanim:"Türkiye'de bankacılık sektörünü düzenleyen ve denetleyen bağımsız idari otorite. LTV oranları, vade sınırları ve özkaynak yeterliliği BDDK tarafından belirlenir.",kategori:"Bankacılık",en:"Banking Regulation and Supervision Agency",ar:"هيئة تنظيم ومراقبة البنوك"},
  {terim:"TCMB (Türkiye Cumhuriyet Merkez Bankası)",tanim:"Para politikasını belirleyen ve zorunlu karşılık oranlarını yöneten merkezi otorite. Katılım bankaları da TCMB denetimi ve düzenlemelerine tabidir.",kategori:"Bankacılık",en:"Central Bank of the Republic of Türkiye",ar:"البنك المركزي للجمهورية التركية"},
  {terim:"MKK (Merkezi Kayıt Kuruluşu) Komisyonu",tanim:"Sukuk/kira sertifikası nakit ödemelerinde alınan komisyon. Formülü: (Anapara + Brüt Getiri) × ‱1 + BSMV (%5). Her iki taraf için de geçerlidir.",kategori:"Bankacılık",en:"Central Securities Depository Commission",ar:"عمولة مركز الإيداع المركزي"},
  {terim:"BKM (Bankalararası Kart Merkezi)",tanim:"Türkiye'de kartlı ödeme altyapısını yöneten kuruluş. POS takas komisyonunu belirler; bankaların POS karlılık analizinin temelini oluşturur.",kategori:"Bankacılık",en:"Interbank Card Center",ar:"مركز البطاقات بين البنوك"},
  {terim:"Efektif Yıllık Oran",tanim:"Dönemsel bileşik getiriyi yıllık bazda ifade eden oran. Formülü: (1 + dönemsel oran)^(365/gün) - 1. Basit yıllık orana kıyasla gerçek maliyeti veya getiriyi daha iyi yansıtır.",kategori:"Bankacılık",en:"Effective Annual Rate",ar:"معدل الفائدة السنوي الفعلي"},
  {terim:"Kredi Kullandırım Ücreti",tanim:"Finansman tahsisinde bankaya ödenen ücret. Bireysel ürünlerde bireysel azami %0,50'dir; vade 12 aydan kısa ise oransal olarak hesaplanır.",kategori:"Bankacılık",en:"Loan Origination Fee",ar:"رسوم منح الائتمان"},
  {terim:"Akreditif",tanim:"Uluslararası ticarette ihracatçıya ödeme güvencesi sağlayan belgesel kredi aracı. Katılım bankalarında 'teyit mektubu' adıyla faizsiz yapıya uygun düzenlenir.",kategori:"Bankacılık",en:"Letter of Credit",ar:"خطاب اعتماد"},
  {terim:"Teminat Mektubu",tanim:"Bankanın müşteri adına lehdara karşı güvence verdiği belge. Kefalete dayanır. Geçici, kesin ve avans teminat mektubu türleri mevcuttur.",kategori:"Bankacılık",en:"Letter of Guarantee",ar:"خطاب ضمان"},

  // ── KATILIM BANKACILIĞI ──────────────────────────────────────────────────
  {terim:"Katılım Bankacılığı",tanim:"Kâr/zarar ortaklığı ve meşru ticaret yöntemlerini esas alan bankacılık sistemi. Fon toplamada ve kullandırmada her para hareketi mutlaka bir mal, hizmet veya varlığa dayanır; gelir ticaret ve ortaklıktan elde edilir.",kategori:"Katılım Bankacılığı",en:"Participation Banking / Islamic Banking",ar:"المصرفية الإسلامية"},
  {terim:"Faizsiz Bankacılık",tanim:"Katılım bankacılığının diğer adı. Faiz içermeyen; parasal işlemlerin mutlaka bir mal, hizmet veya varlığa dayandırıldığı bankacılık sistemi.",kategori:"Katılım Bankacılığı",en:"Interest-Free Banking",ar:"المصرفية الخالية من الفوائد"},
  {terim:"Danışma Komitesi (Dini Kurul)",tanim:"Katılım bankalarının ürün ve hizmetlerinin faizsiz finans ilkelerine uygunluğunu denetleyen ve fetva veren kurul. Bağımsız İslam hukukçularından oluşur.",kategori:"Katılım Bankacılığı",en:"Shariah Advisory Board",ar:"لجنة الفتوى الشرعية"},
  {terim:"TKBB (Türkiye Katılım Bankaları Birliği)",tanim:"Türkiye'deki katılım bankalarını temsil eden sektör kuruluşu. Standart geliştirme, eğitim ve kamuoyu bilgilendirme faaliyetleri yürütür.",kategori:"Katılım Bankacılığı",en:"Participation Banks Association of Türkiye",ar:"اتحاد مصارف المشاركة التركية"},
  {terim:"Özel Finans Kurumu (ÖFK)",tanim:"1983–2005 yılları arasında katılım bankalarının Türkiye'deki resmi adı. 5411 sayılı Bankacılık Kanunu ile 'katılım bankası' adını almışlardır.",kategori:"Katılım Bankacılığı",en:"Special Finance House",ar:"مؤسسة التمويل الخاصة"},
  {terim:"Mudarip",tanim:"Mudaraba ortaklığında sermayeyi işleten ve yöneten taraf. Katılım bankası bu rolü üstlenerek müşteri fonlarını meşru yollarla değerlendirir.",kategori:"Katılım Bankacılığı",en:"Fund Manager (Mudarib)",ar:"مضارب"},
  {terim:"Rab-ül-Mal",tanim:"Mudaraba ortaklığında sermayeyi sağlayan taraf. Katılım hesabında müşteri bu rolü üstlenir; emek ve yönetimi bankaya bırakır.",kategori:"Katılım Bankacılığı",en:"Capital Provider",ar:"رب المال"},
];

function Sozluk(){
  const [ara,setAra]=useState("");
  const [kategori,setKategori]=useState("Tümü");
  const [acik,setAcik]=useState(null);

  const filtre=SOZLUK_DATA.filter(d=>{
    const aramaTutar=ara.length===0||d.terim.toLowerCase().includes(ara.toLowerCase())||d.tanim.toLowerCase().includes(ara.toLowerCase())||(d.en&&d.en.toLowerCase().includes(ara.toLowerCase()));
    const katFil=kategori==="Tümü"||d.kategori===kategori;
    return aramaTutar&&katFil;
  });

  const KATRENKler={"Akad & Fıkıh":"#7C3AED","Finansman Yöntemleri":"#1D4ED8","Hesap Türleri":"#065F46","Menkul Kıymet":"#9A3412","Vergi & Kesinti":"#B45309","Bankacılık":"#1E40AF","Katılım Bankacılığı":"#166534"};
  const katRenk=(k)=>KATRENKler[k]||C.blue;

  return(
    <div style={{display:"flex",flexDirection:"column",background:"#0F1923"}}>
      {/* Arama */}
      <div style={{padding:"10px 14px 6px",background:"#0F1923",flexShrink:0}}>
        <div style={{position:"relative",marginBottom:8}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15}}>🔍</span>
          <input type="text" value={ara} onChange={e=>setAra(e.target.value)}
            placeholder="Türkçe, İngilizce veya açıklama ara..."
            style={{width:"100%",boxSizing:"border-box",padding:"11px 36px 11px 36px",fontSize:13,fontWeight:500,background:"#1C2A38",border:"1.5px solid #2A3A4A",borderRadius:12,color:"#fff",outline:"none"}}/>
          {ara&&<button onClick={()=>setAra("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",color:"#94A3B8",fontSize:18,cursor:"pointer"}}>×</button>}
        </div>
        {/* Kategori filtreleri */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
          {SOZLUK_KATEGORILER.map(k=>(
            <button key={k} onClick={()=>setKategori(k)} style={{
              flexShrink:0,padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,
              background:kategori===k?(k==="Tümü"?"#2563EB":katRenk(k)):"#1C2A38",
              color:kategori===k?"#fff":"#94A3B8",
              transition:"all 0.15s"
            }}>{k}</button>
          ))}
        </div>
        <p style={{margin:"5px 0 0 2px",fontSize:10,color:"#64748B"}}>
          {filtre.length} terim · {ara||kategori!=="Tümü"?`${SOZLUK_DATA.length} içinden filtrelendi`:"Toplam kayıt"}
        </p>
      </div>

      {/* Liste */}
      <div style={{flex:1,overflowY:"auto",padding:"4px 12px 24px"}}>
        {filtre.length===0?(
          <div style={{textAlign:"center",padding:"48px 20px"}}>
            <p style={{fontSize:36,margin:"0 0 10px"}}>🔍</p>
            <p style={{color:"#94A3B8",fontSize:14,margin:0}}><strong style={{color:"#E2E8F0"}}>"{ara}"</strong> için sonuç bulunamadı</p>
          </div>
        ):filtre.map((d,i)=>(
          <div key={i} onClick={()=>setAcik(acik===i?null:i)} style={{
            background:"#1C2A38",borderRadius:14,padding:"13px 15px",marginBottom:8,
            borderLeft:`3px solid ${katRenk(d.kategori)}`,cursor:"pointer",
            transition:"background 0.15s",
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <p style={{margin:"0 0 3px",fontSize:14,fontWeight:800,color:"#E2E8F0"}}>{d.terim}</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:9,fontWeight:700,color:katRenk(d.kategori),background:"rgba(255,255,255,0.06)",padding:"2px 7px",borderRadius:10}}>{d.kategori}</span>
                  {d.en&&<span style={{fontSize:9,color:"#64748B",padding:"2px 7px",background:"rgba(255,255,255,0.04)",borderRadius:10}}>{d.en}</span>}
                </div>
              </div>
              <span style={{color:"#475569",fontSize:14,marginLeft:8,flexShrink:0}}>{acik===i?"▲":"▼"}</span>
            </div>
            {acik===i&&(
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #2A3A4A"}}>
                <p style={{margin:"0 0 8px",fontSize:12,color:"#94A3B8",lineHeight:1.6}}>{d.tanim}</p>
                {d.ar&&<p style={{margin:0,fontSize:13,color:"#64748B",textAlign:"right",fontFamily:"serif",direction:"rtl"}}>{d.ar}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


function Asistan({nav}){
  const [msgs,setMsgs]=useState<any[]>([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [dinliyor,setDinliyor]=useState(false);
  const endRef=useRef();
  const recognitionRef=useRef<any>(null);
  const dinlemeTimeoutRef=useRef<any>(null);

  useEffect(()=>{
    return ()=>{
      try{ recognitionRef.current?.stop(); }catch{}
      if(dinlemeTimeoutRef.current) clearTimeout(dinlemeTimeoutRef.current);
    };
  },[]);

  // ── Sesli giriş (Web Speech API) ────────────────────────────────────────────
  const dinlemeyiDurdur=()=>{
    try{ recognitionRef.current?.stop(); }catch{}
    recognitionRef.current=null;
    if(dinlemeTimeoutRef.current){ clearTimeout(dinlemeTimeoutRef.current); dinlemeTimeoutRef.current=null; }
    setDinliyor(false);
  };

  const sesliGirisBaslat=()=>{
    // Zaten dinliyorsa, tekrar basınca durdur (toggle)
    if(dinliyor||recognitionRef.current){
      dinlemeyiDurdur();
      return;
    }
    const SR:any=(window as any).webkitSpeechRecognition||(window as any).SpeechRecognition;
    if(!SR){
      setMsgs(p=>[...p,{role:"assistant",text:"🎙️ Tarayıcınız sesli komutu desteklemiyor. Lütfen mesajınızı yazarak gönderin.",ekler:[]}]);
      return;
    }
    try{
      const r=new SR();
      r.lang="tr-TR"; r.continuous=false; r.interimResults=false;
      r.onstart=()=>{
        setDinliyor(true);
        // Güvenlik: 8 saniye içinde sonuç gelmezse otomatik kapat (bazı tarayıcılarda onend tetiklenmeyebiliyor)
        dinlemeTimeoutRef.current=setTimeout(()=>dinlemeyiDurdur(),8000);
      };
      r.onend=()=>{ recognitionRef.current=null; setDinliyor(false); if(dinlemeTimeoutRef.current){clearTimeout(dinlemeTimeoutRef.current);dinlemeTimeoutRef.current=null;} };
      r.onerror=()=>{ recognitionRef.current=null; setDinliyor(false); if(dinlemeTimeoutRef.current){clearTimeout(dinlemeTimeoutRef.current);dinlemeTimeoutRef.current=null;} };
      r.onresult=(e:any)=>{
        const t=e.results?.[0]?.[0]?.transcript;
        if(t) setInput(p=>p?`${p} ${t}`:t);
      };
      recognitionRef.current=r;
      r.start();
    }catch{ setDinliyor(false); recognitionRef.current=null; }
  };

  // ── Modül yönlendirme ─────────────────────────────────────────────────────
  const MODUL_MAP=[
    {keys:["konut","mortgage","ev finansman"],screen:"konutFinansman",label:"Konut Finansmanı"},
    {keys:["taşıt","araç","otomobil","araba"],screen:"tasitFinansman",label:"Taşıt Finansmanı"},
    {keys:["togg"],screen:"toggFinansman",label:"Togg Finansmanı"},
    {keys:["leasing","finansal kiralama"],screen:"leasing",label:"Finansal Kiralama"},
    {keys:["spot"],screen:"spotFinansman",label:"Spot Finansman"},
    {keys:["taksitli ticari","ticari finansman","tl büyüme","yp büyüme","tl muaf","yp muaf","tl istisna","yp istisna","büyüme sınır","büyüme istisna"],screen:"taksitliTicari",label:"Taksitli Ticari Finansman"},
    {keys:["pos","komisyon","üye işyeri"],screen:"posHesaplama",label:"POS Komisyon Analizi"},
    {keys:["sukuk","kira sertifikası"],screen:"tahvilBono",label:"Sukuk Kira Sertifikası"},
    {keys:["katılım hesabı","vadeli hesap","vadeli hesap"],screen:"vadeliKatilim",label:"Katılım Hesabı Getiri"},
    {keys:["teminat mektubu"],screen:"tmKomisyon",label:"Teminat Mektubu Komisyon"},
    {keys:["akreditif"],screen:"akreditifKomisyon",label:"Akreditif Komisyon"},
    {keys:["yatırım fonu"],screen:"yatirimFonuFinansman",label:"Yatırım Fonu Finansmanı"},
    {keys:["arsa","işyeri"],screen:"arsaIsyeri",label:"Arsa/İşyeri Finansmanı"},
    {keys:["zk","zorunlu karşılık"],screen:"verimlilikAnalizi",label:"Verimlilik Analizi"},
  ];

  // ── Yakın terim ───────────────────────────────────────────────────────────
  const YAKIN=[
    {yanlis:["murapha","murabaha","mürabaha"],dogru:"Murabaha"},
    {yanlis:["müşereke","müşarka","musaraka"],dogru:"Müşaraka"},
    {yanlis:["mudarebe","mudaraba"],dogru:"Mudaraba"},
    {yanlis:["sukk","sükük","sukük"],dogru:"Sukuk"},
    {yanlis:["icare","icara","ijara"],dogru:"İcara (Finansal Kiralama)"},
    {yanlis:["zk oranı","zorunlu karşılık oranı"],dogru:"Zorunlu Karşılık (ZK)"},
    {yanlis:["kkdf","kaynak kullanımı fonu"],dogru:"KKDF"},
    {yanlis:["bsmv","banka sigorta vergisi"],dogru:"BSMV"},
    {yanlis:["ltv","loan to value"],dogru:"LTV (Finansman-Değer Oranı)"},
  ];

  // ── Sözlük tanımları ──────────────────────────────────────────────────────
  const SOZLUK_KISA={
    "murabaha":"Bankanın müşteri adına aldığı malı maliyet + kâr marjıyla vadeli satması. Katılım bankacılığının temel finansman yöntemi.",
    "mudaraba":"Bir tarafın sermaye, diğerinin emek koyduğu ortaklık. Kâr paylaşılır, zarar sermayeye yüklenir.",
    "müşaraka":"Her iki tarafın sermaye ve yönetime katıldığı ortaklık. Kâr ve zarar katılım oranına göre paylaşılır.",
    "sukuk":"Varlığa dayalı İslami finansal araç. Kira sertifikası olarak da bilinir.",
    "icara":"Finansal kiralama. Banka varlığı alır, kira karşılığı kullandırır.",
    "karz-ı hasen":"Faizsiz borç. Sadece anapara geri alınır.",
    "vekalet":"Yetki devri sözleşmesi. Banka adına işlem yapma yetkisi.",
    "kefalet":"Güvence verme; teminat mektubunun İslami karşılığı.",
    "tekafül":"İslami sigorta sistemi. Karşılıklı yardım esasına dayanır.",
    "garar":"Belirsizlik, meçhuliyet. Aşırı garar içeren işlemler yasaktır.",
  };

  // ── Finansal analiz ───────────────────────────────────────────────────────
  const analizYap=(q)=>{
    const ql=q.toLowerCase();
    // TL vs YP karşılaştırması
    if((ql.includes("tl")&&ql.includes("yp"))||(ql.includes("tl")&&ql.includes("döviz"))){
      const tlOran=parseFloat(q.match(/(%\d+|\d+%)/)?.[0])||null;
      return `💡 **TL vs YP Kredi Analizi**

ZK Talimatı'na göre temel farklar:

**TL Finansman:**
• ZK oranı: %17 (vadesiz/kısa vadeli)
• KKDF: %15 bireysel, tüzel için 0
• BSMV: %15 kâr payı üzerinden
• TL büyüme sınırı: TCMB tarafından belirlenir

**YP Finansman:**
• YP ZK oranı: %25 (vadesiz/kısa vadeli)
• KKDF: Genellikle 0
• Kur riski: Müşteri üstlenir
• Net ihracatçı muafiyeti YP'de geçerli

${tlOran?`%${tlOran} TL oranı için:`:""}Genel kural: YP finansman kur riskini dışarıda bırakırsan daha düşük maliyetli olabilir, ancak kur farkı riski TL'ye göre çok daha yüksektir. Kurumsal müşterilerde YP geliri varsa YP finansman tercih edilir.

❓ Daha detaylı analiz için finansman tutarı ve vadesini paylaşın.`;
    }
    // Maliyet analizi
    if(ql.includes("maliyet")&&(ql.includes("hesap")||ql.includes("analiz"))){
      return `💡 **Finansman Maliyet Analizi**

Toplam maliyet = Anapara + Kâr Payı + BSMV + KKDF + Kredi Kullandırım Komisyonu

• BSMV: Kâr payının %15'i
• KKDF: Bireysel kredilerde kâr payının %15'i (konut/taşıt hariç)
• Kullandırım Komisyonu: Max %0.50 bireysel, %1.10 ticari

📐 Detaylı hesaplama için ilgili finansman modülünü kullanın.`;
    }
    return null;
  };

  // ── Yerel yanıt üret ─────────────────────────────────────────────────────
  const yerelYanit=(q)=>{
    const ql=q.toLowerCase();

    // 1. Sözlük araması
    for(const [terim,tanim] of Object.entries(SOZLUK_KISA)){
      if(ql.includes(terim)){
        return {text:`📖 **${terim.charAt(0).toUpperCase()+terim.slice(1)}**

${tanim}`,tip:"sozluk"};
      }
    }

    // 2. KB araması
    const found=findAnswer(q);
    if(found){
      return {text:`📋 **${found.title}**

${found.content}`,tip:"kb"};
    }

    // 3. Finansal analiz
    const analiz=analizYap(q);
    if(analiz) return {text:analiz,tip:"analiz"};

    // 4. Bulunamadı
    return {text:`Üzgünüm, "${q.slice(0,40)}..." sorusuna bilgi tabanımda yanıt bulamadım.

Yardımcı olabileceğim konular:
• ZK oranları ve uygulaması
• Finansman ücretleri (KKDF, BSMV, komisyon)
• Katılım bankacılığı terimleri
• TL/YP finansman karşılaştırması

💼 Konuyla ilgili daha fazla bilgi için bölge veya segment temsilcinizle iletişime geçebilirsiniz.`,tip:"bulunamadi"};
  };

  // ── Yardımcılar ───────────────────────────────────────────────────────────
  const findYakin=(q)=>{
    const ql=q.toLowerCase();
    for(const t of YAKIN){if(t.yanlis.some(y=>ql.includes(y)))return t.dogru;}
    return null;
  };

  const findModul=(text)=>{
    const tl=text.toLowerCase();
    for(const m of MODUL_MAP){if(m.keys.some(k=>tl.includes(k)))return m;}
    return null;
  };

  // ── Gönder ───────────────────────────────────────────────────────────────
  const send=async()=>{
    const q=input.trim();
    if(!q||loading)return;
    setInput("");
    const newMsgs=[...msgs,{role:"user",text:q,ekler:[]}];
    setMsgs(newMsgs);
    setLoading(true);

    await new Promise(r=>setTimeout(r,400)); // düşünüyor efekti

    const yakin=findYakin(q);
    const {text,tip}=yerelYanit(q);
    const modul=findModul(q);

    const ekler=[];
    if(yakin) ekler.push({tip:"oneri",text:`💡 "${yakin}" terimini mi sormak istediniz?`});
    if(modul) ekler.push({tip:"modul",text:`📐 ${modul.label} → Hesaplamaya Git`,screen:modul.screen,label:modul.label});
    if(tip==="bulunamadi"){
      ekler.push({tip:"uyari",text:"⚠️ Bu konu yerel bilgi tabanımda (ZK Talimatı & Ücretler Tebliği) yer almıyor."});
      ekler.push({tip:"websearch",text:`🔎 Web'de ara: "${q}"`,url:`https://www.google.com/search?q=${encodeURIComponent(q+" katılım bankacılığı")}`});
    }

    setMsgs(p=>[...p,{role:"assistant",text,ekler}]);
    setLoading(false);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  const ONERILEN_ISLEMLER=[
    {key:"spotFinansman", icon:"⚡", label:"Spot Finansman\nHesaplama"},
    {key:"katkiPayi",     icon:"🎁", label:"Katkı Payı\nHesaplama"},
    {key:"posHesaplama",  icon:"💳", label:"POS Komisyon\nHesaplama"},
    {key:"leasing",       icon:"🚙", label:"Finansal Kiralama\nHesaplama"},
  ];

  const sohbetBasladi=msgs.length>0;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100dvh - 182px)",background:"#0F1923"}}>
      {!sohbetBasladi?(
        <div style={{flex:1,overflowY:"auto",padding:"16px 14px"}}>
          {/* Hero kart */}
          <div style={{
            position:"relative",borderRadius:24,padding:"22px 18px",
            background:"linear-gradient(160deg,#16243A 0%,#0F1923 100%)",
            border:"1px solid rgba(59,130,246,0.45)",
            boxShadow:"0 0 28px rgba(59,130,246,0.22), inset 0 0 20px rgba(59,130,246,0.06)",
          }}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16}}>
              <span style={{fontSize:17,fontWeight:800,color:"#fff"}}>Yapay Zeka Asistan</span>
              <span style={{fontSize:16,color:"#3B82F6"}}>➤</span>
            </div>
            <p style={{margin:"0 0 4px",fontSize:17,fontWeight:700,color:"#fff"}}>Merhaba 👋</p>
            <p style={{margin:"0 0 16px",fontSize:13,color:"rgba(255,255,255,0.55)"}}>Bugün ne öğrenmek istiyorsunuz?</p>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.14)",borderRadius:18,padding:"5px 5px 5px 16px"}}>
              <input
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();send();}}}
                placeholder="Mesajınızı yazın veya sesle sorun…"
                style={{flex:1,minWidth:0,background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:13,padding:"10px 0"} as any}/>
              <button onClick={sesliGirisBaslat} style={{
                width:38,height:38,borderRadius:19,border:"none",flexShrink:0,cursor:"pointer",
                background:dinliyor?"#EF4444":"rgba(255,255,255,0.1)",color:"#fff",fontSize:15,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>🎙️</button>
              {input.trim()&&(
                <button onClick={()=>send()} style={{
                  width:38,height:38,borderRadius:19,border:"none",flexShrink:0,cursor:"pointer",
                  background:"#3B82F6",color:"#fff",fontSize:16,
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>↑</button>
              )}
            </div>
            <p style={{margin:"12px 0 0",fontSize:10,color:dinliyor?"#F87171":"rgba(255,255,255,0.3)",textAlign:"center"}}>
              {dinliyor?"🔴 Dinleniyor… durdurmak için mikrofona tekrar dokun":"📄 ZK Talimatı (17.06.2026) & Ücretler Tebliği (2020/4) bilgi tabanı yüklü"}
            </p>
          </div>

          {/* Önerilen İşlemler */}
          <div style={{fontSize:13,fontWeight:800,color:"#fff",margin:"22px 0 10px"}}>Önerilen İşlemler</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {ONERILEN_ISLEMLER.map(o=>(
              <div key={o.key} onClick={()=>nav(o.key)} style={{
                background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:14,padding:"14px 12px",cursor:"pointer",
                display:"flex",alignItems:"center",gap:10,
              }}>
                <span style={{fontSize:20,flexShrink:0}}>{o.icon}</span>
                <span style={{fontSize:12,fontWeight:700,color:"#E8F0FA",lineHeight:1.3,whiteSpace:"pre-line"}}>{o.label}</span>
              </div>
            ))}
          </div>
        </div>
      ):(
        <>
          <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:12}}>
                <div style={{maxWidth:"92%"}}>
                  <div style={{padding:"10px 14px",
                    borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                    background:m.role==="user"?"#3B82F6":"rgba(255,255,255,0.07)",
                    color:"#fff",
                    fontSize:14,lineHeight:1.65,
                    whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                    {m.text}
                  </div>
                  {m.ekler?.map((ek:any,ei:number)=>(
                    <div key={ei} style={{marginTop:6}}>
                      {ek.tip==="modul"?(
                        <button onClick={()=>nav(ek.screen)} style={{width:"100%",padding:"9px 14px",borderRadius:12,border:"1.5px solid #3B82F6",background:"rgba(59,130,246,0.12)",color:"#7DB2FF",fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                          📐 {ek.label} → Hesaplamaya Git
                        </button>
                      ):ek.tip==="websearch"?(
                        <button onClick={()=>window.open(ek.url,"_blank")} style={{width:"100%",padding:"9px 14px",borderRadius:12,border:"1.5px solid rgba(255,255,255,0.18)",background:"rgba(255,255,255,0.05)",color:"#E8F0FA",fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                          {ek.text} ↗
                        </button>
                      ):(
                        <div style={{padding:"8px 12px",borderRadius:10,fontSize:12,lineHeight:1.5,
                          background:ek.tip==="uyari"?"rgba(248,113,113,0.12)":"rgba(59,130,246,0.12)",
                          color:ek.tip==="uyari"?"#F87171":"#7DB2FF",
                          border:`1px solid ${ek.tip==="uyari"?"rgba(248,113,113,0.3)":"rgba(59,130,246,0.3)"}`,
                        }}>{ek.text}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{display:"flex",justifyContent:"flex-start",marginBottom:12}}>
                <div style={{padding:"12px 18px",borderRadius:"18px 18px 18px 4px",background:"rgba(255,255,255,0.07)"}}>
                  <span style={{fontSize:18,letterSpacing:4,color:"rgba(255,255,255,0.4)"}}>· · ·</span>
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>
          <div style={{padding:"10px 14px 20px",background:"#15212E",borderTop:"1px solid rgba(255,255,255,0.08)",flexShrink:0}}>
            <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
              <textarea value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                placeholder="Mesajınızı yazın veya sesle sorun…"
                rows={1}
                style={{flex:1,padding:"12px 14px",borderRadius:14,border:"1px solid rgba(255,255,255,0.14)",fontSize:14,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none",resize:"none",fontFamily:"-apple-system,sans-serif",lineHeight:1.4} as any}/>
              <button onClick={sesliGirisBaslat} style={{width:42,height:42,borderRadius:21,border:"none",flexShrink:0,cursor:"pointer",background:dinliyor?"#EF4444":"rgba(255,255,255,0.1)",color:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>🎙️</button>
              <button onClick={()=>send()} disabled={loading||!input.trim()}
                style={{width:42,height:42,borderRadius:21,border:"none",background:input.trim()&&!loading?"#3B82F6":"rgba(255,255,255,0.1)",color:"#fff",fontSize:18,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TaksitliTicariFinansman({s,onGecmis}){
  const [doviz,setDoviz]=useState("TL");
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [tip,setTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const [showPlan,setShowPlan]=useState(false);

  const SABIT_KULLANIRIM=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const fmtDoviz=(n)=>n==null?"—":`${dovizSembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`;

  // Döviz değişince komisyon sıfırla
  useEffect(()=>{ setKullKomisyon("1.10"); },[doviz]);

  // TL: vade değişince azami komisyonu doldur
  const prevVadeRef=useRef("");
  useEffect(()=>{
    if(vade!==prevVadeRef.current){
      prevVadeRef.current=vade;
      if(doviz==="TL"){
        const V=parseInt(vade);
        if(V>0){
          // Taksitli: aylık vade, 12 aydan az ise oransal
          const gunEquiv=V*30;
          const azami=gunEquiv<365?SABIT_KULLANIRIM*(gunEquiv/365):SABIT_KULLANIRIM;
          setKullKomisyon(fmtN(azami,4).replace(",","."));
        }
      }
    }
  },[vade]);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),V=parseFloat(vade),rt=parseFloat(oran);
    if(!T||!V||!rt)return null;
    const ao=tip==="yillik"?rt/12/100:rt/100;

    // TL: BSMV/KKDF var, YP: yok
    const bsmvR=doviz==="TL"?s.ticariBSMV:0;
    const kkdfR=doviz==="TL"?s.ticariKKDF:0;

    const taksit=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const toplamOdeme=taksit*V;
    const toplamKarPayi=toplamOdeme-T;
    const kkdfTL=toplamKarPayi*(kkdfR/100);
    const bsmvTL=toplamKarPayi*(bsmvR/100);

    const plan=hesaplaOdemePlani(T,V,ao,bsmvR,kkdfR);
    const aylikTaksit=plan?plan._toplamSabitTaksit:taksit;
    const toplamVadeMaliyet=aylikTaksit?Math.round(aylikTaksit*V*100)/100:toplamOdeme+kkdfTL+bsmvTL;

    // Komisyon
    const kullOranGiris=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azamiKull=doviz==="TL"?(gunEquiv<365?SABIT_KULLANIRIM*(gunEquiv/365):SABIT_KULLANIRIM):null;
    const kullOranUyg=doviz==="TL"?Math.min(kullOranGiris,azamiKull):kullOranGiris;
    const kullAsim=doviz==="TL"&&kullOranGiris>azamiKull;
    const kullUcret=kullOranGiris>0?Math.round(T*(kullOranUyg/100)*100)/100:0;

    const toplamMaliyet=Math.round((toplamVadeMaliyet+kullUcret)*100)/100;

    // Plan satırlarına komisyon ekle (sadece ilk satırda peşin)
    if(plan&&kullUcret>0) plan[0]={...plan[0],komisyon:kullUcret};

    // Efektif yıllık maliyet - bisection yöntemi (kararlı IRR)
    // Müşteri taksiti BSMV dahil, anapara komisyon düşülmüş
    const taksitBrutMusteri = taksit * (1 + bsmvR/100);
    const T_net = T - kullUcret; // müşterinin kullandığı gerçek tutar
    let efektifAylik=0;
    if(T_net>0&&V>0&&taksitBrutMusteri>0){
      let lo=0.0001/12, hi=3.0/12;
      for(let i=0;i<200;i++){
        const mid=(lo+hi)/2;
        const pv=taksitBrutMusteri*(1-Math.pow(1+mid,-V))/mid;
        if(pv>T_net) lo=mid; else hi=mid;
      }
      efektifAylik=(lo+hi)/2;
    }
    const efektifYillik=efektifAylik>0?Math.round((Math.pow(1+efektifAylik,12)-1)*10000)/100:0;

    return{taksit,aylikTaksit,toplamKarPayi,toplamOdeme,kkdfTL,bsmvTL,plan,
      toplamVadeMaliyet,toplamMaliyet,efektifYillik,
      kullUcret,kullOranUyg,kullAsim,azamiKull,bsmvR,kkdfR};
  },[tutar,vade,oran,tip,doviz,kullKomisyon,s])();


  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani
        plan={r.plan} bsmvOran={r?.bsmvR||0} kkdfOran={r?.kkdfR||0}
        onClose={()=>setShowPlan(false)} showKomisyon={r?.kullUcret>0}
        basitOran={tip==="aylik"?parseFloat(oran)*12:parseFloat(oran)} efektifOran={r?.efektifYillik}
       anaparaTutar={parseFloat(tutar)}/>}
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"aylik",l:"Aylık %"},{v:"yillik",l:"Yıllık %"}]} value={tip} onChange={setTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${tip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        {/* Kullandırım Komisyonu */}
        <div style={{marginBottom:4}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
          <div style={{position:"relative"}}>
            <input type="number" inputMode="decimal" value={kullKomisyon}
              onChange={e=>{
                const val=parseFloat(e.target.value)||0;
                const V=parseInt(vade)||0;
                const gunEquiv=V*30;
                const azami=gunEquiv>0&&gunEquiv<365?1.10*(gunEquiv/365):1.10;
                setKullKomisyon(doviz==="TL"&&val>azami?fmtN(azami,4).replace(",","."):e.target.value);
              }}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
            <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
          </div>
          <p style={{margin:"3px 0 0 2px",fontSize:11,color:C.sub}}>
            {doviz==="TL"
              ? (vade?`TL azami: %${fmtN(r?.azamiKull??SABIT_KULLANIRIM,4)}${parseInt(vade)<12?" (oransal)":""} — aşağı revize edilebilir`:"TL — Madde 9/2, oransal tavan")
              : "YP — Tavan yok, serbestçe belirlenebilir (Madde 9/2)"}
          </p>
          {r?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"7px 10px",marginTop:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami %{fmtN(r.azamiKull,4)} uygulandı</p>
          </div>}
        </div>
      </Card>
      {r&&<>
        <Card>
          <SecTitle>Kâr Payı & Vergi {doviz!=="TL"&&`(${doviz})`}</SecTitle>
          {r.taksit&&<RRow label="Aylık Taksit (Sabit)" value={fmtDoviz(r.aylikTaksit||r.taksit)} accent={C.blue} big/>}
          <RRow label="Toplam Kâr Payı" value={fmtDoviz(r.toplamKarPayi)}/>
          {doviz==="TL"&&<>
            <RRow label={`BSMV (%${s.ticariBSMV})`} value={fmtTL(r.bsmvTL)} sub accent={C.red}/>
            <RRow label={`KKDF (%${s.ticariKKDF})`} value={fmtTL(r.kkdfTL)} sub accent={C.red}/>
          </>}
          {r.kullUcret>0&&<RRow label={`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`} value={fmtDoviz(r.kullUcret)} accent={C.purple} sub/>}
          <RRow label="Toplam Müşteri Maliyeti" value={fmtDoviz(r.toplamMaliyet)} accent={C.green} big/>
          {r.efektifYillik>0&&<RRow label="Efektif Yıllık Maliyet %" value={`% ${fmtN(r.efektifYillik,2)}`} sub/>}
          {r.taksit&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <button onClick={()=>{setShowPlan(true);if(onGecmis)onGecmis({modul:"Taksitli Ticari Finansman",tutar:fmtTL(parseFloat(tutar)),vade:vade+" Ay",oran:oran+"%",sonuc:fmtTL(r?.toplamMaliyet),aylikTaksit:fmtTL(r?.aylikTaksit),plan:r?.plan})}} style={{padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>
              📅 Ödeme Planı
            </button>
            <RaporButon baslik={`Taksitli Ticari Finansman (${doviz})`} plan={r.plan} satirlar={[
          {label:"Anapara", value:fmtTL(parseFloat(tutar)), big:true},
              {label:"Aylık Taksit", value:fmtDoviz(r.aylikTaksit||r.taksit), big:true},
              {label:"Toplam Kâr Payı", value:fmtDoviz(r.toplamKarPayi)},
              doviz==="TL"?{label:`BSMV (%${s.ticariBSMV})`, value:fmtTL(r.bsmvTL)}:null,
              doviz==="TL"?{label:`KKDF (%${s.ticariKKDF})`, value:fmtTL(r.kkdfTL)}:null,
              r.kullUcret>0?{label:`Kredi Kullandırım Komisyonu (%${fmtN(r.kullOranUyg,4)} — peşin)`, value:fmtDoviz(r.kullUcret)}:null,
              {label:"Toplam Müşteri Maliyeti", value:fmtDoviz(r.toplamMaliyet), big:true},
              {label:"Anapara", value:fmtTL(parseFloat(tutar))},
          {label:"Basit Yıllık Oran", value:`% ${fmtN(parseFloat(oran),2)}`},
          {label:"Efektif Yıllık Oran", value:r?.efektifYillik>0?`% ${fmtN(r.efektifYillik,2)}`:"—"},
        ].filter(Boolean)} bsmvOran={r?.bsmvR||s.ticariBSMV} kkdfOran={r?.kkdfR||s.ticariKKDF}/>
          </div>}
        </Card>
      </>}
    </div>
  );
}

function KasaOranAnalizi(){
  const [mod,setMod]=useState("basilden_bilesik");
  const [gunlukOran,setGunlukOran]=useState("");
  const [vadeGun,setVadeGun]=useState("");
  const [hedefBilesik,setHedefBilesik]=useState("");

  const r=useCallback(()=>{
    const G=parseInt(vadeGun);
    if(!G)return null;

    if(mod==="basilden_bilesik"){
      const yb=parseFloat(gunlukOran);
      if(!yb)return null;
      // Günlük oran (360 baz)
      const gunlukR=yb/100/365;
      // N gün bileşik getiri: (1+gunlukR)^N - 1
      const bilesikDonem=Math.pow(1+gunlukR,G)-1;
      // Bu bileşik getiriyi yıllık basit orana çevir: getiri/N*365
      const esdeğerYillikBasil=(bilesikDonem/G)*365*100;
      // 1M ₺ için getiri
      const getiri1M=bilesikDonem*1000000;
      return{mod,yb,G,bilesikDonem:bilesikDonem*100,esdeğerYillikBasil,getiri1M};
    } else {
      const hb=parseFloat(hedefBilesik);
      if(!hb)return null;
      // Hedef yıllık basit → N günlük getiri
      const hedefDonem=hb/100/365*G;
      // Gereken günlük bileşik: (1+hedefDonem)^(1/N) - 1
      const gunlukR=Math.pow(1+hedefDonem,1/G)-1;
      // Yıllık basit eşdeğeri
      const gerekliYillikBasil=gunlukR*365*100;
      return{mod,hb,G,hedefDonem:hedefDonem*100,gerekliYillikBasil};
    }
  },[mod,gunlukOran,vadeGun,hedefBilesik])();

  return(
    <div style={{padding:"0 16px 32px"}}>

      <Card>
        <Seg options={[{v:"basilden_bilesik",l:"Basit → Eşdeğer Basit"},{v:"bilesikten_basil",l:"Hedef Basit → Gerekli"}]} value={mod} onChange={setMod}/>
        <Field label="Temdit Vade (Gün)" value={vadeGun} onChange={setVadeGun} suffix="Gün" hint="Kaç günde bir yenileniyor? (örn: 32, 91)"/>
        {mod==="basilden_bilesik"
          ? <Field label="Yıllık Basit Kâr Payı Oranı" value={gunlukOran} onChange={setGunlukOran} suffix="%" hint="Hesabın açıldığı oran (örn: 40)"/>
          : <Field label="Hedef Yıllık Basit Oran" value={hedefBilesik} onChange={setHedefBilesik} suffix="%" hint="Ulaşmak istediğin eşdeğer basit oran (örn: 40.50)"/>
        }
      </Card>

      {r&&r.mod==="basilden_bilesik"&&<Card>
        <SecTitle>Bileşik Eşdeğer Oran</SecTitle>
        <RRow label="Açılış Oranı (Yıllık Basit)" value={`% ${fmtN(r.yb,2)}`}/>
        <RRow label={`${r.G} Günlük Getiri`} value={`% ${fmtN(r.bilesikDonem,4)}`} sub accent={C.orange}/>
        <div style={{height:1,background:C.border,margin:"6px 0"}}/>
        <RRow label="Bileşik Eşdeğer Yıllık Basit" value={`% ${fmtN(r.esdeğerYillikBasil,4)}`} accent={C.blue} big/>
        <div style={{background:C.blueLight,borderRadius:10,padding:"12px 14px",marginTop:10}}>
          <p style={{margin:0,fontSize:14,color:C.blue,fontWeight:800,lineHeight:1.6}}>
            %{fmtN(r.yb,2)} ile açılan hesap {r.G} gün temdit edilince
          </p>
          <p style={{margin:"2px 0 0",fontSize:18,fontWeight:800,color:"#1C3A5E"}}>
            ≡ %{fmtN(r.esdeğerYillikBasil,4)} yıllık basit
          </p>
          <p style={{margin:"6px 0 0",fontSize:12,color:C.sub}}>
            1.000.000 ₺ için {r.G} günlük getiri: {fmtTL(r.getiri1M)}
          </p>
        </div>
      </Card>}

      {r&&r.mod==="bilesikten_basil"&&<Card>
        <SecTitle>Gereken Açılış Oranı</SecTitle>
        <RRow label="Hedef Eşdeğer Basit Oran" value={`% ${fmtN(r.hb,2)}`}/>
        <RRow label={`${r.G} Günlük Hedef Getiri`} value={`% ${fmtN(r.hedefDonem,4)}`} sub accent={C.orange}/>
        <div style={{height:1,background:C.border,margin:"6px 0"}}/>
        <RRow label="Gereken Açılış Oranı (Yıllık Basit)" value={`% ${fmtN(r.gerekliYillikBasil,4)}`} accent={C.blue} big/>
        <div style={{background:C.blueLight,borderRadius:10,padding:"12px 14px",marginTop:10}}>
          <p style={{margin:0,fontSize:14,color:C.blue,fontWeight:800,lineHeight:1.6}}>
            {r.G} günde %{fmtN(r.hb,2)} eşdeğer basit elde etmek için
          </p>
          <p style={{margin:"2px 0 0",fontSize:18,fontWeight:800,color:"#1C3A5E"}}>
            %{fmtN(r.gerekliYillikBasil,4)} ile açılmalı
          </p>
        </div>
      </Card>}
    </div>
  );
}


function VerimlilikAnalizi({s}){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [doviz,setDoviz]=useState("TL");
  const [katilim,setKatilim]=useState("vadesiz");

  // Ayarlardan varsayılan oran: vadesiz=cari, diğerleri=katılım
  const defaultOran = katilim==="vadesiz"
    ? String(s.cariKarPayiOran||35)
    : String(s.katilimKarPayiOran||2);
  const [getiriOrani,setGetiriOrani]=useState(defaultOran);

  // Katılım dilimi değişince oranı güncelle
  useEffect(()=>{
    setGetiriOrani(katilim==="vadesiz"
      ? String(s.cariKarPayiOran||35)
      : String(s.katilimKarPayiOran||2));
  },[katilim,s.cariKarPayiOran,s.katilimKarPayiOran]);

  // TL ZK oranları (vadeye göre)
  const TL_ZK={vadesiz:17,"1ay":17,"3ay":10,"6ay":10,"1yil":10};
  // YP ZK oranları (ilave %2.5 dahil)
  const YP_ZK={vadesiz:32.5,"1ay":32.5,"3ay":28.5,"6ay":28.5,"1yil":28.5};

  // Vade gün sayıları (ZK hesabı için)
  const VADE_GUN={vadesiz:1,"1ay":31,"3ay":92,"6ay":182,"1yil":365};

  const KATILIM_OPTS=[
    {v:"vadesiz",l:"Vadesiz"},
    {v:"1ay",l:"1 Ay"},
    {v:"3ay",l:"3 Ay"},
    {v:"6ay",l:"6 Ay"},
    {v:"1yil",l:"1 Yıl"},
  ];

  const r=useCallback(()=>{
    const T=parseFloat(tutar);
    if(!T)return null;
    const _minVade = {vadesiz:1,"1ay":32,"3ay":92,"6ay":180,"1yil":360}[katilim]||1;
    const _vadeNum = parseInt(vade)||0;
    if(katilim!=="vadesiz" && _vadeNum>0 && _vadeNum<_minVade) return null;

    const zkOran=(doviz==="TL"?TL_ZK:YP_ZK)[katilim]/100;
    // Kullanılabilir tutar = Toplam × (1 - ZK oranı)
    const kullanilanTutar=Math.round(T*(1-zkOran)*100)/100;
    const zkTutar=T-kullanilanTutar;
    const vadeGun=parseInt(vade)||VADE_GUN[katilim];

    if(!getiriOrani||!vade)return{kullanilanTutar,zkTutar,zkOran:zkOran*100,T};

    const go=parseFloat(getiriOrani);
    const gunlukOran=go/100/365;

    // Getiri sadece kullanılan tutar üzerinden (ZK bloke kısım getiri sağlamaz)
    const brutFaiz=Math.round(kullanilanTutar*gunlukOran*vadeGun*100)/100;

    // Efektif yıllık getiri (toplam tutar üzerinden)
    const efektifYillik=(brutFaiz/T)/vadeGun*365*100;

    // Getiri oranının ZK etkisiyle azalması
    const efektifVsNominal=go*(1-zkOran);

    return{
      kullanilanTutar,zkTutar,zkOran:zkOran*100,T,
      brutFaiz,efektifYillik,efektifVsNominal,
      vadeGun,go,
      spread:go-s.fonlamaMaliyeti,
    };
  },[tutar,vade,getiriOrani,doviz,katilim])();

  const zkOranGoster=(doviz==="TL"?TL_ZK:YP_ZK)[katilim];
  const tutarNum=parseFloat(tutar)||0;
  const kullanilanAuto=Math.round(tutarNum*(1-zkOranGoster/100)*100)/100;

  // Min vade kontrolü
  const MIN_VADE: Record<string,number> = {vadesiz:1,"1ay":32,"3ay":92,"6ay":180,"1yil":360};
  const minVade = MIN_VADE[katilim] || 1;
  const vadeNum = parseInt(vade)||0;
  const vadeHatali = katilim !== "vadesiz" && vadeNum > 0 && vadeNum < minVade;
  const vadeUyari = vadeHatali ? `En az ${minVade} gün girilmeli (${katilim === "1ay" ? "1 Ay" : katilim === "3ay" ? "3 Ay" : katilim === "6ay" ? "6 Ay" : "1 Yıl"} dilimi)` : null;

  const handleVade = (v: string) => {
    const sayi = v.replace(/\D/g,"");
    setVade(sayi);
  };

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"Türk Lirası (TL)"},{v:"YP",l:"Yabancı Para (YP)"}]} value={doviz} onChange={setDoviz}/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:6}}>Cari Katılım Dilimi</label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:5,marginBottom:14}}>
          {KATILIM_OPTS.map(o=>(
            <button key={o.v} onClick={()=>setKatilim(o.v)} style={{
              padding:"8px 2px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
              background:katilim===o.v?C.blue:"rgba(91,155,216,0.10)",
              color:katilim===o.v?"#fff":C.sub,
            }}>{o.l}</button>
          ))}
        </div>
        {/* ZK oranı bandı */}
        <div style={{background:C.blueLight,borderRadius:10,padding:"8px 14px",marginBottom:14,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:C.blue,fontWeight:600}}>ZK Oranı ({doviz})</span>
          <span style={{fontSize:14,fontWeight:800,color:C.blue}}>% {zkOranGoster}</span>
        </div>
        <Field label="Tutar" value={tutar} onChange={setTutar} suffix={doviz==="TL"?"₺":"$"}/>
        {/* ZK Dahil Tutar - otomatik, read-only */}
        {tutarNum>0&&<div style={{background:"rgba(91,155,216,0.10)",borderRadius:10,padding:"11px 14px",marginBottom:14,border:`1.5px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:C.sub,fontWeight:600}}>Kullanılabilir Tutar (ZK Sonrası)</span>
            <span style={{fontSize:15,fontWeight:800,color:C.green}}>{fmtTL(kullanilanAuto)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
            <span style={{fontSize:11,color:C.sub}}>ZK Bloke Tutarı</span>
            <span style={{fontSize:13,fontWeight:700,color:C.red}}>{fmtTL(tutarNum-kullanilanAuto)}</span>
          </div>
        </div>}
        <div>
          <Field label="Vade (Gün)" value={vade} onChange={handleVade} suffix="Gün"
            hint={katilim==="vadesiz" ? "Herhangi bir vade girilebilir" : `Min. ${minVade} gün (seçilen dilim)`}/>
          {vadeUyari && (
            <div style={{background:"rgba(224,165,61,0.18)",border:"1px solid #FBBF24",borderRadius:8,padding:"7px 12px",marginTop:-8,marginBottom:12,fontSize:12,color:"#92400E",display:"flex",alignItems:"center",gap:6}}>
              ⚠️ {vadeUyari}
            </div>
          )}
        </div>
        <Field label="Kâr Payı Oranı (Yıllık)" value={getiriOrani} onChange={setGetiriOrani} suffix="%"/>
      </Card>

      {r&&r.brutFaiz!==undefined&&<Card>
        <SecTitle>Verimlilik Analizi</SecTitle>
        <RRow label="Toplam Tutar" value={fmtTL(r.T)}/>
        <RRow label={`ZK Bloke (%${fmtN(r.zkOran)})`} value={`- ${fmtTL(r.zkTutar)}`} sub accent={C.red}/>
        <RRow label="Kullanılabilir Tutar" value={fmtTL(r.kullanilanTutar)} accent={C.blue}/>
        <div style={{height:1,background:C.border,margin:"6px 0"}}/>
        <RRow label={`Gelir (${r.vadeGun} Gün)`} value={fmtTL(r.brutFaiz)} accent={C.orange} big/>

      </Card>}
    </div>
  );
}



// ─── ESNEK ÖDEME PLANLARI ────────────────────────────────────────────────────
const BSMV_ORAN = 5; // %5 sabit

function GecmisKaydetButon({onGecmis, kayit}:any){
  const [kaydedildi,setKaydedildi]=useState(false);
  if(!onGecmis) return null;
  return(
    <button onClick={()=>{onGecmis(kayit);setKaydedildi(true);setTimeout(()=>setKaydedildi(false),2000);}}
      style={{width:"100%",marginBottom:6,padding:"10px",borderRadius:12,
        border:`1.5px solid ${kaydedildi?C.green:C.blue}`,
        background:kaydedildi?C.greenLight:C.blueLight,
        color:kaydedildi?C.green:C.blue,
        fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>
      {kaydedildi?"✅ Kaydedildi":"🕐 Geçmişe Kaydet"}
    </button>
  );
}

function OdemePlanTablosu({plan, showKomisyon=false}){
  const fmt=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const totTaksit=plan.reduce((s,r)=>s+(r.taksit||0),0);
  const totKP=plan.reduce((s,r)=>s+(r.karPayi||0),0);
  const totAna=plan.reduce((s,r)=>s+(r.anapara||0),0);
  const totBsmv=plan.reduce((s,r)=>s+(r.bsmv||0),0);
  return(
    <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginTop:8}}>
      <div style={{minWidth:480}}>
        <div style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",background:"#1C3A5E",padding:"6px 4px"}}>
          {["#","Tarih","Taksit","Anapara","Kâr Payı","BSMV","Kalan"].map((h,i)=>(
            <span key={i} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:i>1?"right":"center",padding:"0 2px"}}>{h}</span>
          ))}
        </div>
        <div style={{maxHeight:300,overflowY:"auto"}}>
          {plan.map((r,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:i%2===0?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
              <span style={{fontSize:9,color:"#6B7280",textAlign:"center",fontWeight:600}}>{r.ay}</span>
              <span style={{fontSize:9,color:"#6B7280",textAlign:"center"}}>{r.tarih||""}</span>
              {[r.taksit,r.anapara,r.karPayi,r.bsmv,r.bakiye].map((v,vi)=>(
                <span key={vi} style={{fontSize:9,color:"#F1F5F9",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>{fmt(v)}</span>
              ))}
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:"#1C3A5E"}}>
          <span style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"center"}}>∑</span>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.5)",textAlign:"center"}}>—</span>
          {[totTaksit,totAna,totKP,totBsmv,"—"].map((v,vi)=>(
            <span key={vi} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>{typeof v==="number"?fmt(v):v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function EsnekOdemePlanlari({nav}){
  const planlar=[
    {key:"esitAnapara",   icon:"📊", baslik:"Eşit Anapara Ödeme Planı",  aciklama:"Her ay eşit anapara, azalan taksit"},
    {key:"araOdemeli",    icon:"💡", baslik:"Ara Ödemeli Plan",           aciklama:"Belirli aylarda ekstra anapara ödemesi"},
    {key:"artanOdemeli",  icon:"📈", baslik:"Artan Ödemeli Plan",         aciklama:"Her dönem artan taksit ödemesi"},
    {key:"azalanOdemeli", icon:"📉", baslik:"Azalan Ödemeli Plan",        aciklama:"Her dönem azalan taksit ödemesi"},
    {key:"balonOdemeli",  icon:"🎈", baslik:"Balon Ödemeli Plan",         aciklama:"Vadede büyük son ödeme (balon)"},
    {key:"esnekOdemeli",  icon:"🔧", baslik:"Esnek Ödemeli Plan",         aciklama:"Her ay farklı anapara girişi"},
  ];
  return(
    <div style={{padding:"0 16px 32px"}}>
      <div style={{background:C.blueLight,borderRadius:12,padding:"10px 14px",marginBottom:14,border:`1px solid ${C.blue}33`}}>
        <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:600}}>BSMV: %5 · KKDF: %0 · Tüm planlarda uygulanır</p>
      </div>
      {planlar.map((p,i)=>(
        <div key={i} onClick={()=>nav(p.key)} style={{display:"flex",alignItems:"center",gap:14,background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:9,cursor:"pointer",border:`1px solid ${C.border}`}}>
          <div style={{width:46,height:46,borderRadius:12,background:C.blueLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{p.icon}</div>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:15,fontWeight:700,color:C.label}}>{p.baslik}</p>
            <p style={{margin:"2px 0 0",fontSize:12,color:C.sub}}>{p.aciklama}</p>
          </div>
          <span style={{color:C.sep,fontSize:20}}>›</span>
        </div>
      ))}
    </div>
  );
}

function EsitAnapara({onGecmis}:any){
  const [doviz,setDoviz]=useState("TL");
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [oranTip,setOranTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const SABIT_KULL=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const bsmvR=doviz==="TL"?BSMV_ORAN:0;

  useEffect(()=>{setKullKomisyon("1.10");},[doviz]);
  useEffect(()=>{
    if(doviz==="TL"){
      const V=parseInt(vade)||0;
      if(V>0){const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(fmtN(az,4).replace(",","."));}
    }
  },[vade,doviz]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100);
    if(!T||!V||!ao) return null;
    const esitAna=Math.round(T/V*100)/100;
    const kullO=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azami=doviz==="TL"?(gunEquiv<365?SABIT_KULL*(gunEquiv/365):SABIT_KULL):null;
    const kullOUyg=doviz==="TL"?Math.min(kullO,azami):kullO;
    const kullUcret=Math.round(T*(kullOUyg/100)*100)/100;
    const now=new Date();
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*bsmvR/100*100)/100;
      const anapara=i<V?esitAna:Math.round(bakiye*100)/100;
      bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      rows.push({ay:i,tarih:MONTHS[d.getMonth()]+" "+d.getFullYear(),taksit:Math.round((anapara+kp+bsmv)*100)/100,anapara,karPayi:kp,bsmv,bakiye});
    }
    const toplamTaksit=rows.reduce((s,r)=>s+r.taksit,0);
    const toplamKP=rows.reduce((s,r)=>s+r.karPayi,0);
    const toplamBsmv=rows.reduce((s,r)=>s+r.bsmv,0);
    const toplamMaliyet=Math.round((toplamTaksit+kullUcret)*100)/100;
    // Efektif yıllık
    const T_net=T-kullUcret;
    let ef=0;
    if(T_net>0&&V>0&&rows[0]?.taksit>0){
      let lo=0.0001/12,hi=3/12;
      const taksit1=rows[0].taksit;
      for(let i=0;i<200;i++){const mid=(lo+hi)/2;const pv=rows.reduce((s,r,ri)=>s+r.taksit/Math.pow(1+mid,ri+1),0);if(pv>T_net)lo=mid;else hi=mid;}
      ef=Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
    }
    return{rows,toplamTaksit,toplamKP,toplamBsmv,toplamMaliyet,kullUcret,kullOUyg,ef,azami,kullAsim:doviz==="TL"&&kullO>azami};
  },[tutar,vade,oran,oranTip,doviz,kullKomisyon]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"yillik",l:"Yıllık %"},{v:"aylik",l:"Aylık %"}]} value={oranTip} onChange={setOranTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${oranTip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{const v=parseFloat(e.target.value)||0;const V=parseInt(vade)||0;const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(doviz==="TL"&&v>az?fmtN(az,4).replace(",","."):e.target.value);}}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>{doviz==="TL"?`TL azami: %${fmtN(plan?.azami??SABIT_KULL,4)}`:"YP — Tavan yok"}</p>
        {plan?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"6px 10px",marginTop:4}}><p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami uygulandı</p></div>}
        {doviz==="TL"&&<div style={{marginTop:8,background:"rgba(91,155,216,0.10)",borderRadius:8,padding:"6px 10px",display:"flex",gap:16}}>
          <p style={{margin:0,fontSize:11,color:C.sub}}>BSMV: <strong>%{BSMV_ORAN}</strong></p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>KKDF: <strong>%0</strong></p>
        </div>}
      </Card>
      {plan?.rows&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`${dovizSembol}${fmt2(parseFloat(tutar))}`}/>
          {plan.kullUcret>0&&<RRow label={`Kullandırım Komisyonu (%${fmtN(plan.kullOUyg,4)})`} value={`${dovizSembol}${fmt2(plan.kullUcret)}`} sub accent={C.orange}/>}
          <RRow label="İlk Taksit" value={`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`}/>
          <RRow label="Son Taksit" value={`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`}/>
          <RRow label="Toplam Taksit" value={`${dovizSembol}${fmt2(plan.toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`${dovizSembol}${fmt2(plan.toplamKP)}`} accent={C.orange}/>
          {doviz==="TL"&&<RRow label={`Toplam BSMV (%${BSMV_ORAN})`} value={`${dovizSembol}${fmt2(plan.toplamBsmv)}`} sub/>}
          <RRow label="Toplam Maliyet" value={`${dovizSembol}${fmt2(plan.toplamMaliyet)}`} accent={C.blue} big/>
          {plan.ef>0&&<RRow label="Efektif Yıllık Maliyet" value={`% ${fmt2(plan.ef)}`} sub/>}
        </Card>
        <Card><SecTitle>Ödeme Planı</SecTitle><OdemePlanTablosu plan={plan.rows}/></Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Eşit Anapara Ödeme Planı",tutar:`${dovizSembol}${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`,netGetiri:`${dovizSembol}${fmt2(plan.toplamKP)}`,aylikTaksit:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`,plan:[]}}/>
        <RaporButon baslik="Eşit Anapara Ödeme Planı" satirlar={[
          {label:"Finansman Tutarı", value:`${dovizSembol}${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Kâr Payı Oranı", value:`%${oran} (${oranTip==="yillik"?"Yıllık":"Aylık"})`},
          ...(plan.kullUcret>0?[{label:`Kullandırım Kom. (%${fmtN(plan.kullOUyg,4)})`, value:`${dovizSembol}${fmt2(plan.kullUcret)}`}]:[]),
          {label:"İlk Taksit", value:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`, big:true},
          {label:"Son Taksit", value:`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`},
          {label:"Toplam Kâr Payı", value:`${dovizSembol}${fmt2(plan.toplamKP)}`},
          {label:"Toplam Maliyet", value:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`, big:true},
          ...(plan.ef>0?[{label:"Efektif Yıllık Maliyet", value:`%${fmt2(plan.ef)}`}]:[]),
        ]} plan={plan.rows.map(r=>({...r,taksit:r.taksit,anapara:r.anapara,karPayi:r.karPayi,bakiye:r.bakiye}))}/>
      </>}
    </div>
  );
}

function AraOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [oranTip,setOranTip]=useState("aylik"); // aylik | yillik
  const [ilkAraAy,setIlkAraAy]=useState("");
  const [araSiklik,setAraSiklik]=useState("");
  const [araTutar,setAraTutar]=useState("");
  const [araYontem,setAraYontem]=useState("sadece");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

  const araAylar=useMemo(()=>{
    const ilk=parseInt(ilkAraAy)||0;
    const siklik=parseInt(araSiklik)||0;
    const V=parseInt(vade)||0;
    if(!ilk||!V) return [];
    const aylar=[];
    for(let ay=ilk;ay<=V;ay+=siklik||V){
      aylar.push(ay);
      if(!siklik) break;
    }
    return aylar;
  },[ilkAraAy,araSiklik,vade]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),rt=parseFloat(oran),AT=parseFloat(araTutar)||0;
    if(!T||!V||!rt) return null;
    const ao=oranTip==="yillik"?rt/100/12:rt/100;
    const now=new Date();

    // Bisection: her ara ödeme tam AT, normal taksit sabit, plan sonu bakiye=0
    const simule=(pmt:number)=>{
      let b=T;
      for(let i=1;i<=V;i++){
        const kp=Math.round(b*ao*100)/100;
        const bsmv=Math.round(kp*BSMV_ORAN/100*100)/100;
        if(araAylar.includes(i)&&AT>0){
          // Ara ödeme: her zaman tam AT (anapara = AT - kp - bsmv)
          const ana=Math.round((AT-kp-bsmv)*100)/100;
          b=Math.round((b-ana)*100)/100;
        } else {
          if(b<=0) break;
          const ana=Math.min(Math.max(0,Math.round((pmt-kp)*100)/100),b);
          b=Math.max(0,Math.round((b-ana)*100)/100);
        }
      }
      return b;
    };

    let lo=0.01, hi=T;
    for(let i=0;i<300;i++){
      const mid=(lo+hi)/2;
      if(simule(mid)>0) lo=mid; else hi=mid;
    }
    const pmt=(lo+hi)/2;

    // Planı oluştur
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      if(bakiye<=0&&!araAylar.includes(i)) break;
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*BSMV_ORAN/100*100)/100;
      const isAraAy=araAylar.includes(i)&&AT>0;
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      const tarihStr=MONTHS[d.getMonth()]+" "+d.getFullYear();

      if(isAraAy){
        // Tam AT ödenir
        const anapara=Math.round((AT-kp-bsmv)*100)/100;
        bakiye=Math.round((bakiye-anapara)*100)/100;
        rows.push({ay:i,tarih:tarihStr,taksit:AT,anapara,kp,bsmv,bakiye:Math.max(0,bakiye),isAra:true});
        bakiye=Math.max(0,bakiye);
      } else {
        const sonAy=bakiye<=pmt-kp+0.01;
        const anapara=sonAy?Math.round(bakiye*100)/100:Math.min(Math.max(0,Math.round((pmt-kp)*100)/100),bakiye);
        const taksit=Math.round((anapara+kp+bsmv)*100)/100;
        bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
        rows.push({ay:i,tarih:tarihStr,taksit,anapara,kp,bsmv,bakiye,isAra:false});
      }
      if(bakiye<=0&&i===V) break;
    }
    return rows;
  },[tutar,vade,oran,oranTip,araAylar,araTutar,araYontem]);

  const normalRows=plan?.filter(r=>!r.isAra)||[];
  const toplamTaksit=plan?.reduce((s,r)=>s+r.taksit,0)||0;
  const toplamKP=plan?.reduce((s,r)=>s+r.kp,0)||0;
  const toplamBsmv=plan?.reduce((s,r)=>s+r.bsmv,0)||0;

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <div style={{marginBottom:13}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <label style={{fontSize:12,fontWeight:600,color:C.sub}}>Kâr Payı Oranı</label>
            <div style={{display:"flex",background:"rgba(255,255,255,0.08)",borderRadius:8,padding:2}}>
              {[{v:"aylik",l:"Aylık"},{v:"yillik",l:"Yıllık"}].map(o=>(
                <button key={o.v} onClick={()=>setOranTip(o.v)} style={{padding:"3px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:oranTip===o.v?C.blue:"transparent",color:oranTip===o.v?"#fff":C.sub}}>{o.l}</button>
              ))}
            </div>
          </div>
          <Field label="" value={oran} onChange={setOran} suffix="%"/>
        </div>
        <div style={{height:1,background:C.border,margin:"4px 0 14px"}}/>
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:C.blue}}>Ara Ödeme Planı</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:13}}>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>İlk Ara Ödeme</label>
            <div style={{position:"relative"}}>
              <input inputMode="numeric" value={ilkAraAy} onChange={e=>setIlkAraAy(e.target.value.replace(/[^0-9]/g,""))}
                placeholder="0"
                style={{width:"100%",boxSizing:"border-box",padding:"11px 52px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none"}}/>
              <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:10,color:C.sub,fontWeight:600}}>Taksit No</span>
            </div>
          </div>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Ara Ödeme Sıklığı</label>
            <div style={{position:"relative"}}>
              <input inputMode="numeric" value={araSiklik} onChange={e=>setAraSiklik(e.target.value.replace(/[^0-9]/g,""))}
                placeholder="0"
                style={{width:"100%",boxSizing:"border-box",padding:"11px 36px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none"}}/>
              <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:C.sub,fontWeight:600}}>Ay</span>
            </div>
          </div>
        </div>
        {araAylar.length>0&&<div style={{background:C.blueLight,borderRadius:8,padding:"7px 12px",marginBottom:12}}>
          <p style={{margin:0,fontSize:11,color:C.blue,fontWeight:600}}>Ara ödeme ayları: {araAylar.join(", ")}</p>
        </div>}
        <Field label="Ara Ödeme Tutarı (Toplam Taksit)" value={araTutar} onChange={setAraTutar} suffix="₺" hint="Bu tutar toplam taksit tutarıdır (kâr payı + BSMV dahil)"/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:8}}>Ara Ödeme Yöntemi</label>
        {[
          {v:"sadece",l:"Ara Ödeme Tutarını Öde",a:"O ay sadece ara ödeme yapılır"},
          {v:"ekle",l:"Taksite Eklensin",a:"Normal taksit + ara ödeme aynı ayda"},
        ].map(o=>(
          <div key={o.v} onClick={()=>setAraYontem(o.v)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:12,border:`2px solid ${araYontem===o.v?C.blue:C.border}`,background:araYontem===o.v?C.blueLight:C.card,marginBottom:8,cursor:"pointer"}}>
            <div style={{width:20,height:20,borderRadius:10,border:`2px solid ${araYontem===o.v?C.blue:C.border}`,background:araYontem===o.v?C.blue:C.card,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {araYontem===o.v&&<div style={{width:8,height:8,borderRadius:4,background:"#fff"}}/>}
            </div>
            <div>
              <p style={{margin:0,fontSize:13,fontWeight:700,color:araYontem===o.v?C.blue:C.label}}>{o.l}</p>
              <p style={{margin:"2px 0 0",fontSize:11,color:C.sub}}>{o.a}</p>
            </div>
          </div>
        ))}
      </Card>
      {plan&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`₺${fmt2(parseFloat(tutar))}`}/>
          <RRow label="Normal Taksit Tutarı" value={`₺${fmt2(normalRows[0]?.taksit)}`}/>
          <RRow label={`Ara Ödeme (${araAylar.length} kez)`} value={`₺${fmt2(parseFloat(araTutar||"0"))} × ${araAylar.length}`} accent={C.orange}/>
          <RRow label="Toplam Geri Ödeme" value={`₺${fmt2(toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`₺${fmt2(toplamKP)}`} accent={C.orange}/>
          <RRow label="Toplam BSMV (%5)" value={`₺${fmt2(toplamBsmv)}`} sub/>
        </Card>
        <Card>
          <SecTitle>Ödeme Planı</SecTitle>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginTop:8}}>
            <div style={{minWidth:480}}>
              <div style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",background:"#1C3A5E",padding:"6px 4px"}}>
                {["#","Tarih","Taksit","Anapara","Kâr Payı","BSMV","Kalan"].map((h,i)=>(
                  <span key={i} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:i>1?"right":"center",padding:"0 2px"}}>{h}</span>
                ))}
              </div>
              <div style={{maxHeight:350,overflowY:"auto"}}>
                {plan.map((r,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:r.isAra?"rgba(224,165,61,0.18)":i%2===0?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.02)",borderBottom:`1px solid ${r.isAra?"#FFD700":"rgba(255,255,255,0.1)"}`,borderLeft:r.isAra?"3px solid #FFB800":"none"}}>
                    <span style={{fontSize:9,color:r.isAra?"#B8860B":"#6B7280",textAlign:"center",fontWeight:700}}>{r.ay}</span>
                    <span style={{fontSize:9,color:r.isAra?"#B8860B":"#6B7280",textAlign:"center"}}>{r.tarih}</span>
                    {[r.taksit,r.anapara,r.kp,r.bsmv,r.bakiye].map((v,vi)=>(
                      <span key={vi} style={{fontSize:9,color:r.isAra?"#B8860B":"#F1F5F9",textAlign:"right",fontFamily:"monospace",padding:"0 2px",fontWeight:r.isAra?700:400}}>{v!=null?fmt2(v):"—"}</span>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"28px 70px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:"#1C3A5E"}}>
                <span style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"center"}}>∑</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>—</span>
                {[toplamTaksit,plan.reduce((s,r)=>s+r.anapara,0),toplamKP,toplamBsmv,"—"].map((v,vi)=>(
                  <span key={vi} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>{typeof v==="number"?fmt2(v):v}</span>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Ara Ödemeli Plan",tutar:`₺${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`₺${fmt2(toplamTaksit)}`,netGetiri:`₺${fmt2(toplamKP)}`,aylikTaksit:"—",plan:[]}}/>
        <RaporButon baslik="Ara Ödemeli Plan" satirlar={[
          {label:"Finansman Tutarı", value:`₺${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Ara Ödeme Ayları", value:araAylar.join(", ")||"—"},
          {label:"Ara Ödeme Tutarı", value:`₺${fmt2(parseFloat(araTutar))}`},
          {label:"Toplam Kâr Payı", value:`₺${fmt2(toplamKP)}`},
          {label:"Toplam BSMV", value:`₺${fmt2(toplamBsmv)}`},
          {label:"Toplam Ödeme", value:`₺${fmt2(toplamTaksit)}`, big:true},
        ]} plan={plan.map(r=>({...r,karPayi:r.kp}))}/>
      </>}
    </div>
  );
}

function ArtanOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [artisOran,setArtisOran]=useState("");

  const [doviz,setDoviz]=useState("TL");
  const [oranTip,setOranTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const SABIT_KULL=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const bsmvR=doviz==="TL"?BSMV_ORAN:0;
  useEffect(()=>{setKullKomisyon("1.10");},[doviz]);
  useEffect(()=>{
    if(doviz==="TL"){const V=parseInt(vade)||0;if(V>0){const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(fmtN(az,4).replace(",","."));}}
  },[vade,doviz]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100),ar=parseFloat(artisOran)/100||0;
    if(!T||!V||!ao) return null;
    let pmt0=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    if(ar>0){let pv=0;for(let i=1;i<=V;i++)pv+=pmt0*Math.pow(1+ar,i-1)/Math.pow(1+ao,i);pmt0=pmt0*(T/pv);}
    const kullO=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azami=doviz==="TL"?(gunEquiv<365?SABIT_KULL*(gunEquiv/365):SABIT_KULL):null;
    const kullOUyg=doviz==="TL"?Math.min(kullO,azami):kullO;
    const kullUcret=Math.round(T*(kullOUyg/100)*100)/100;
    const now=new Date();
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      const taksitNet=Math.round(pmt0*Math.pow(1+ar,i-1)*100)/100;
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*bsmvR/100*100)/100;
      const anapara=Math.min(Math.round((taksitNet-kp)*100)/100,bakiye);
      bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      rows.push({ay:i,tarih:MONTHS[d.getMonth()]+" "+d.getFullYear(),taksit:Math.round((anapara+kp+bsmv)*100)/100,anapara,karPayi:kp,bsmv,bakiye});
    }
    const toplamTaksit=rows.reduce((s,r)=>s+r.taksit,0);
    const toplamKP=rows.reduce((s,r)=>s+r.karPayi,0);
    const toplamBsmv=rows.reduce((s,r)=>s+r.bsmv,0);
    const toplamMaliyet=Math.round((toplamTaksit+kullUcret)*100)/100;
    const T_net=T-kullUcret;
    let ef=0;
    if(T_net>0&&V>0){
      let lo=0.0001/12,hi=3/12;
      for(let i=0;i<200;i++){const mid=(lo+hi)/2;const pv=rows.reduce((s,r,ri)=>s+r.taksit/Math.pow(1+mid,ri+1),0);if(pv>T_net)lo=mid;else hi=mid;}
      ef=Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
    }
    return{rows,toplamTaksit,toplamKP,toplamBsmv,toplamMaliyet,kullUcret,kullOUyg,ef,azami,kullAsim:doviz==="TL"&&kullO>azami};
  },[tutar,vade,oran,oranTip,artisOran,doviz,kullKomisyon]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"yillik",l:"Yıllık %"},{v:"aylik",l:"Aylık %"}]} value={oranTip} onChange={setOranTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${oranTip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <Field label="Aylık Artış Oranı" value={artisOran} onChange={setArtisOran} suffix="%" hint="Her ay taksit bu oranda artar"/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{const v=parseFloat(e.target.value)||0;const V=parseInt(vade)||0;const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(doviz==="TL"&&v>az?fmtN(az,4).replace(",","."):e.target.value);}}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>{doviz==="TL"?`TL azami: %${fmtN(plan?.azami??SABIT_KULL,4)}`:"YP — Tavan yok"}</p>
        {plan?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"6px 10px",marginTop:4}}><p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami uygulandı</p></div>}
        {doviz==="TL"&&<div style={{marginTop:8,background:"rgba(91,155,216,0.10)",borderRadius:8,padding:"6px 10px",display:"flex",gap:16}}>
          <p style={{margin:0,fontSize:11,color:C.sub}}>BSMV: <strong>%{BSMV_ORAN}</strong></p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>KKDF: <strong>%0</strong></p>
        </div>}
      </Card>
      {plan?.rows&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`${dovizSembol}${fmt2(parseFloat(tutar))}`}/>
          {plan.kullUcret>0&&<RRow label={`Kullandırım Komisyonu (%${fmtN(plan.kullOUyg,4)})`} value={`${dovizSembol}${fmt2(plan.kullUcret)}`} sub accent={C.orange}/>}
          <RRow label="İlk Taksit" value={`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`}/>
          <RRow label="Son Taksit" value={`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`}/>
          <RRow label="Toplam Taksit" value={`${dovizSembol}${fmt2(plan.toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`${dovizSembol}${fmt2(plan.toplamKP)}`} accent={C.orange}/>
          {doviz==="TL"&&<RRow label={`Toplam BSMV (%${BSMV_ORAN})`} value={`${dovizSembol}${fmt2(plan.toplamBsmv)}`} sub/>}
          <RRow label="Toplam Maliyet" value={`${dovizSembol}${fmt2(plan.toplamMaliyet)}`} accent={C.blue} big/>
          {plan.ef>0&&<RRow label="Efektif Yıllık Maliyet" value={`% ${fmt2(plan.ef)}`} sub/>}
        </Card>
        <Card><SecTitle>Ödeme Planı</SecTitle><OdemePlanTablosu plan={plan.rows}/></Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Artan Ödemeli Plan",tutar:`${dovizSembol}${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`,netGetiri:`${dovizSembol}${fmt2(plan.toplamKP)}`,aylikTaksit:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`,plan:[]}}/>
        <RaporButon baslik="Artan Ödemeli Plan" satirlar={[
          {label:"Finansman Tutarı", value:`${dovizSembol}${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Kâr Payı Oranı", value:`%${oran} (${oranTip==="yillik"?"Yıllık":"Aylık"})`},
          ...(plan.kullUcret>0?[{label:`Kullandırım Kom.`, value:`${dovizSembol}${fmt2(plan.kullUcret)}`}]:[]),
          {label:"İlk Taksit", value:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`},
          {label:"Son Taksit", value:`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`},
          {label:"Toplam Kâr Payı", value:`${dovizSembol}${fmt2(plan.toplamKP)}`},
          {label:"Toplam Maliyet", value:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`, big:true},
          ...(plan.ef>0?[{label:"Efektif Yıllık Maliyet", value:`%${fmt2(plan.ef)}`}]:[]),
        ]} plan={plan.rows.map(r=>({...r,karPayi:r.karPayi}))}/>
      </>}
    </div>
  );
}

function AzalanOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [azalisOran,setAzalisOran]=useState("");

  const [doviz,setDoviz]=useState("TL");
  const [oranTip,setOranTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const SABIT_KULL=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const bsmvR=doviz==="TL"?BSMV_ORAN:0;
  useEffect(()=>{setKullKomisyon("1.10");},[doviz]);
  useEffect(()=>{
    if(doviz==="TL"){const V=parseInt(vade)||0;if(V>0){const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(fmtN(az,4).replace(",","."));}}
  },[vade,doviz]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100),az2=parseFloat(azalisOran)/100||0;
    if(!T||!V||!ao) return null;
    let pmt0=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    if(az2>0){let pv=0;for(let i=1;i<=V;i++)pv+=pmt0*Math.pow(1-az2,i-1)/Math.pow(1+ao,i);pmt0=pmt0*(T/pv);}
    const kullO=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azami=doviz==="TL"?(gunEquiv<365?SABIT_KULL*(gunEquiv/365):SABIT_KULL):null;
    const kullOUyg=doviz==="TL"?Math.min(kullO,azami):kullO;
    const kullUcret=Math.round(T*(kullOUyg/100)*100)/100;
    const now=new Date();
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      const taksitNet=Math.round(pmt0*Math.pow(1-az2,i-1)*100)/100;
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*bsmvR/100*100)/100;
      const anapara=Math.min(Math.max(0,Math.round((taksitNet-kp)*100)/100),bakiye);
      bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      rows.push({ay:i,tarih:MONTHS[d.getMonth()]+" "+d.getFullYear(),taksit:Math.round((anapara+kp+bsmv)*100)/100,anapara,karPayi:kp,bsmv,bakiye});
    }
    const toplamTaksit=rows.reduce((s,r)=>s+r.taksit,0);
    const toplamKP=rows.reduce((s,r)=>s+r.karPayi,0);
    const toplamBsmv=rows.reduce((s,r)=>s+r.bsmv,0);
    const toplamMaliyet=Math.round((toplamTaksit+kullUcret)*100)/100;
    const T_net=T-kullUcret;
    let ef=0;
    if(T_net>0&&V>0){
      let lo=0.0001/12,hi=3/12;
      for(let i=0;i<200;i++){const mid=(lo+hi)/2;const pv=rows.reduce((s,r,ri)=>s+r.taksit/Math.pow(1+mid,ri+1),0);if(pv>T_net)lo=mid;else hi=mid;}
      ef=Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
    }
    return{rows,toplamTaksit,toplamKP,toplamBsmv,toplamMaliyet,kullUcret,kullOUyg,ef,azami,kullAsim:doviz==="TL"&&kullO>azami};
  },[tutar,vade,oran,oranTip,azalisOran,doviz,kullKomisyon]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"yillik",l:"Yıllık %"},{v:"aylik",l:"Aylık %"}]} value={oranTip} onChange={setOranTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${oranTip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <Field label="Aylık Azalış Oranı" value={azalisOran} onChange={setAzalisOran} suffix="%" hint="Her ay taksit bu oranda azalır"/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{const v=parseFloat(e.target.value)||0;const V=parseInt(vade)||0;const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(doviz==="TL"&&v>az?fmtN(az,4).replace(",","."):e.target.value);}}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>{doviz==="TL"?`TL azami: %${fmtN(plan?.azami??SABIT_KULL,4)}`:"YP — Tavan yok"}</p>
        {plan?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"6px 10px",marginTop:4}}><p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami uygulandı</p></div>}
        {doviz==="TL"&&<div style={{marginTop:8,background:"rgba(91,155,216,0.10)",borderRadius:8,padding:"6px 10px",display:"flex",gap:16}}>
          <p style={{margin:0,fontSize:11,color:C.sub}}>BSMV: <strong>%{BSMV_ORAN}</strong></p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>KKDF: <strong>%0</strong></p>
        </div>}
      </Card>
      {plan?.rows&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`${dovizSembol}${fmt2(parseFloat(tutar))}`}/>
          {plan.kullUcret>0&&<RRow label={`Kullandırım Komisyonu (%${fmtN(plan.kullOUyg,4)})`} value={`${dovizSembol}${fmt2(plan.kullUcret)}`} sub accent={C.orange}/>}
          <RRow label="İlk Taksit" value={`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`}/>
          <RRow label="Son Taksit" value={`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`}/>
          <RRow label="Toplam Taksit" value={`${dovizSembol}${fmt2(plan.toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`${dovizSembol}${fmt2(plan.toplamKP)}`} accent={C.orange}/>
          {doviz==="TL"&&<RRow label={`Toplam BSMV (%${BSMV_ORAN})`} value={`${dovizSembol}${fmt2(plan.toplamBsmv)}`} sub/>}
          <RRow label="Toplam Maliyet" value={`${dovizSembol}${fmt2(plan.toplamMaliyet)}`} accent={C.blue} big/>
          {plan.ef>0&&<RRow label="Efektif Yıllık Maliyet" value={`% ${fmt2(plan.ef)}`} sub/>}
        </Card>
        <Card><SecTitle>Ödeme Planı</SecTitle><OdemePlanTablosu plan={plan.rows}/></Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Azalan Ödemeli Plan",tutar:`${dovizSembol}${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`,netGetiri:`${dovizSembol}${fmt2(plan.toplamKP)}`,aylikTaksit:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`,plan:[]}}/>
        <RaporButon baslik="Azalan Ödemeli Plan" satirlar={[
          {label:"Finansman Tutarı", value:`${dovizSembol}${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Kâr Payı Oranı", value:`%${oran} (${oranTip==="yillik"?"Yıllık":"Aylık"})`},
          ...(plan.kullUcret>0?[{label:`Kullandırım Kom.`, value:`${dovizSembol}${fmt2(plan.kullUcret)}`}]:[]),
          {label:"İlk Taksit", value:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`},
          {label:"Son Taksit", value:`${dovizSembol}${fmt2(plan.rows[plan.rows.length-1]?.taksit)}`},
          {label:"Toplam Kâr Payı", value:`${dovizSembol}${fmt2(plan.toplamKP)}`},
          {label:"Toplam Maliyet", value:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`, big:true},
          ...(plan.ef>0?[{label:"Efektif Yıllık Maliyet", value:`%${fmt2(plan.ef)}`}]:[]),
        ]} plan={plan.rows.map(r=>({...r,karPayi:r.karPayi}))}/>
      </>}
    </div>
  );
}

function BalonOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [balonTutar,setBalonTutar]=useState("");

  const [doviz,setDoviz]=useState("TL");
  const [oranTip,setOranTip]=useState("yillik");
  const [kullKomisyon,setKullKomisyon]=useState("1.10");
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const SABIT_KULL=1.10;
  const dovizSembol=doviz==="TL"?"₺":doviz==="USD"?"$":"€";
  const bsmvR=doviz==="TL"?BSMV_ORAN:0;
  useEffect(()=>{setKullKomisyon("1.10");},[doviz]);
  useEffect(()=>{
    if(doviz==="TL"){const V=parseInt(vade)||0;if(V>0){const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(fmtN(az,4).replace(",","."));}}
  },[vade,doviz]);

  const plan=useMemo(()=>{
    const T=parseFloat(tutar),V=parseInt(vade),ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100),B=parseFloat(balonTutar)||0;
    if(!T||!V||!ao) return null;
    const T_ara=T-B/Math.pow(1+ao,V);
    const pmt=ao===0?T_ara/V:T_ara*ao/(1-Math.pow(1+ao,-V));
    const kullO=parseFloat(kullKomisyon.replace(",","."))||0;
    const gunEquiv=V*30;
    const azami=doviz==="TL"?(gunEquiv<365?SABIT_KULL*(gunEquiv/365):SABIT_KULL):null;
    const kullOUyg=doviz==="TL"?Math.min(kullO,azami):kullO;
    const kullUcret=Math.round(T*(kullOUyg/100)*100)/100;
    const now=new Date();
    let bakiye=T; const rows=[];
    for(let i=1;i<=V;i++){
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*bsmvR/100*100)/100;
      const anapara=i<V?Math.min(Math.round((pmt-kp)*100)/100,bakiye):Math.round(bakiye*100)/100;
      bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      rows.push({ay:i,tarih:MONTHS[d.getMonth()]+" "+d.getFullYear(),taksit:Math.round((anapara+kp+bsmv)*100)/100,anapara,karPayi:kp,bsmv,bakiye});
    }
    const toplamTaksit=rows.reduce((s,r)=>s+r.taksit,0);
    const toplamKP=rows.reduce((s,r)=>s+r.karPayi,0);
    const toplamBsmv=rows.reduce((s,r)=>s+r.bsmv,0);
    const toplamMaliyet=Math.round((toplamTaksit+kullUcret)*100)/100;
    const T_net=T-kullUcret;
    let ef=0;
    if(T_net>0&&V>0){
      let lo=0.0001/12,hi=3/12;
      for(let i=0;i<200;i++){const mid=(lo+hi)/2;const pv=rows.reduce((s,r,ri)=>s+r.taksit/Math.pow(1+mid,ri+1),0);if(pv>T_net)lo=mid;else hi=mid;}
      ef=Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
    }
    return{rows,toplamTaksit,toplamKP,toplamBsmv,toplamMaliyet,kullUcret,kullOUyg,ef,azami,kullAsim:doviz==="TL"&&kullO>azami};
  },[tutar,vade,oran,oranTip,balonTutar,doviz,kullKomisyon]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"TL",l:"₺ TL"},{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"}]} value={doviz} onChange={setDoviz}/>
        <Seg options={[{v:"yillik",l:"Yıllık %"},{v:"aylik",l:"Aylık %"}]} value={oranTip} onChange={setOranTip}/>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix={dovizSembol}/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <Field label={`Kâr Payı Oranı (${oranTip==="yillik"?"Yıllık":"Aylık"})`} value={oran} onChange={setOran} suffix="%"/>
        <Field label="Balon Ödeme Tutarı" value={balonTutar} onChange={setBalonTutar} suffix={dovizSembol} hint="Son ayda ödenecek büyük tutar"/>

        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Kredi Kullandırım Komisyonu</label>
        <div style={{position:"relative",marginBottom:4}}>
          <input type="number" inputMode="decimal" value={kullKomisyon}
            onChange={e=>{const v=parseFloat(e.target.value)||0;const V=parseInt(vade)||0;const az=V*30<365?SABIT_KULL*(V*30/365):SABIT_KULL;setKullKomisyon(doviz==="TL"&&v>az?fmtN(az,4).replace(",","."):e.target.value);}}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 40px 11px 13px",fontSize:15,fontWeight:600,fontFamily:"monospace",background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",WebkitAppearance:"none"}}/>
          <span style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>%</span>
        </div>
        <p style={{margin:"0 0 0 2px",fontSize:11,color:C.sub}}>{doviz==="TL"?`TL azami: %${fmtN(plan?.azami??SABIT_KULL,4)}`:"YP — Tavan yok"}</p>
        {plan?.kullAsim&&<div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"6px 10px",marginTop:4}}><p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ TL azami uygulandı</p></div>}
        {doviz==="TL"&&<div style={{marginTop:8,background:"rgba(91,155,216,0.10)",borderRadius:8,padding:"6px 10px",display:"flex",gap:16}}>
          <p style={{margin:0,fontSize:11,color:C.sub}}>BSMV: <strong>%{BSMV_ORAN}</strong></p>
          <p style={{margin:0,fontSize:11,color:C.sub}}>KKDF: <strong>%0</strong></p>
        </div>}
      </Card>
      {plan?.rows&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`${dovizSembol}${fmt2(parseFloat(tutar))}`}/>
          {plan.kullUcret>0&&<RRow label={`Kullandırım Komisyonu (%${fmtN(plan.kullOUyg,4)})`} value={`${dovizSembol}${fmt2(plan.kullUcret)}`} sub accent={C.orange}/>}
          <RRow label="Toplam Taksit" value={`${dovizSembol}${fmt2(plan.toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`${dovizSembol}${fmt2(plan.toplamKP)}`} accent={C.orange}/>
          {doviz==="TL"&&<RRow label={`Toplam BSMV (%${BSMV_ORAN})`} value={`${dovizSembol}${fmt2(plan.toplamBsmv)}`} sub/>}
          <RRow label="Toplam Maliyet" value={`${dovizSembol}${fmt2(plan.toplamMaliyet)}`} accent={C.blue} big/>
          {plan.ef>0&&<RRow label="Efektif Yıllık Maliyet" value={`% ${fmt2(plan.ef)}`} sub/>}
        </Card>
        <Card><SecTitle>Ödeme Planı</SecTitle><OdemePlanTablosu plan={plan.rows}/></Card>
        <GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Balon Ödemeli Plan",tutar:`${dovizSembol}${fmt2(parseFloat(tutar))}`,vade:vade+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`,netGetiri:`${dovizSembol}${fmt2(plan.toplamKP)}`,aylikTaksit:`${dovizSembol}${fmt2(plan.rows[0]?.taksit)}`,plan:[]}}/>
        <RaporButon baslik="Balon Ödemeli Plan" satirlar={[
          {label:"Finansman Tutarı", value:`${dovizSembol}${fmt2(parseFloat(tutar))}`},
          {label:"Vade", value:`${vade} Ay`},
          {label:"Kâr Payı Oranı", value:`%${oran} (${oranTip==="yillik"?"Yıllık":"Aylık"})`},
          {label:"Balon Ödeme", value:`${dovizSembol}${fmt2(parseFloat(balonTutar))}`},
          ...(plan.kullUcret>0?[{label:"Kullandırım Kom.", value:`${dovizSembol}${fmt2(plan.kullUcret)}`}]:[]),
          {label:"Toplam Kâr Payı", value:`${dovizSembol}${fmt2(plan.toplamKP)}`},
          {label:"Toplam Maliyet", value:`${dovizSembol}${fmt2(plan.toplamMaliyet)}`, big:true},
          ...(plan.ef>0?[{label:"Efektif Yıllık Maliyet", value:`%${fmt2(plan.ef)}`}]:[]),
        ]} plan={plan.rows.map(r=>({...r,karPayi:r.karPayi}))}/>
      </>}
    </div>
  );
}

function EsnekOdemeli({onGecmis}:any){
  const [tutar,setTutar]=useState("");
  const [vade,setVade]=useState("");
  const [oran,setOran]=useState("");
  const [oranTip,setOranTip]=useState("aylik");
  const [sabitTutar,setSabitTutar]=useState<{[k:number]:string}>({});
  const [odemeYapma,setOdemeYapma]=useState<{[k:number]:boolean}>({});
  const [araOdeme,setAraOdeme]=useState<{[k:number]:string}>({});
  const MONTHS=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const fmt2=(n:any)=>n==null||isNaN(n)?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

  const V=parseInt(vade)||0;
  const T=parseFloat(tutar)||0;
  const ao=(oranTip==="yillik"?parseFloat(oran)/100/12:parseFloat(oran)/100)||0;

  const plan=useMemo(()=>{
    if(!T||!V||!ao) return null;
    const pmt=ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V));
    const now=new Date();
    let bakiye=T; const rows=[];

    for(let i=1;i<=V;i++){
      if(bakiye<=0) break;
      const kp=Math.round(bakiye*ao*100)/100;
      const bsmv=Math.round(kp*BSMV_ORAN/100*100)/100;
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      const tarihStr=MONTHS[d.getMonth()]+" "+d.getFullYear();
      const atla=odemeYapma[i]||false;
      const sabit=parseFloat(sabitTutar[i]||"")||0;
      const ekstra=parseFloat(araOdeme[i]||"")||0;
      const sonAy=i===V;

      if(atla){
        // Ödeme yapılmıyor — kâr payı bakiyeye eklenir
        const yeniBakiye=Math.round((bakiye+kp)*100)/100;
        rows.push({ay:i,tarih:tarihStr,taksit:0,anapara:0,kp,bsmv:0,bakiye:yeniBakiye,atla:true,sabit:0,ekstra:0});
        bakiye=yeniBakiye;
      } else {
        // Sabit tutar varsa onu kullan, yoksa standart PMT
        const hedefTaksit=sabit>0?sabit:pmt+bsmv;
        // hedefTaksit = anapara + kp + bsmv → anapara = hedefTaksit - kp - bsmv
        const anaFromHedef=Math.max(0,Math.round((hedefTaksit-kp-bsmv)*100)/100);
        let anapara=sonAy?Math.round(bakiye*100)/100:Math.min(anaFromHedef,bakiye);
        // Ekstra ara ödeme ekle
        if(ekstra>0) anapara=Math.min(Math.round((anapara+ekstra)*100)/100,bakiye);
        const taksit=Math.round((anapara+kp+bsmv)*100)/100;
        bakiye=Math.max(0,Math.round((bakiye-anapara)*100)/100);
        rows.push({ay:i,tarih:tarihStr,taksit,anapara,kp,bsmv,bakiye,atla:false,sabit,ekstra});
      }
      if(bakiye<=0) break;
    }
    return rows;
  },[T,V,ao,sabitTutar,odemeYapma,araOdeme]);

  const stdTaksit=T&&V&&ao?Math.round((ao===0?T/V:T*ao/(1-Math.pow(1+ao,-V))+(T*ao*BSMV_ORAN/100))*100)/100:0;
  const toplamTaksit=plan?.reduce((s,r)=>s+r.taksit,0)||0;
  const toplamKP=plan?.reduce((s,r)=>s+r.kp,0)||0;
  const toplamBsmv=plan?.reduce((s,r)=>s+r.bsmv,0)||0;

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Field label="Finansman Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Vade (Ay)" value={vade} onChange={setVade} suffix="Ay"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <label style={{fontSize:12,fontWeight:600,color:C.sub}}>Kâr Payı Oranı</label>
          <div style={{display:"flex",background:"rgba(255,255,255,0.08)",borderRadius:8,padding:2}}>
            {[{v:"aylik",l:"Aylık"},{v:"yillik",l:"Yıllık"}].map(o=>(
              <button key={o.v} onClick={()=>setOranTip(o.v)} style={{padding:"3px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:oranTip===o.v?C.blue:"transparent",color:oranTip===o.v?"#fff":C.sub}}>{o.l}</button>
            ))}
          </div>
        </div>
        <Field label="" value={oran} onChange={setOran} suffix="%"/>
        {stdTaksit>0&&<div style={{background:C.blueLight,borderRadius:10,padding:"8px 12px"}}>
          <p style={{margin:0,fontSize:12,color:C.blue,fontWeight:600}}>Standart Taksit: <span style={{fontFamily:"monospace",fontWeight:800}}>₺{fmt2(stdTaksit)}</span></p>
        </div>}
      </Card>

      {plan&&plan.length>0&&(
        <Card style={{padding:"10px 8px"}}>
          <SecTitle>Aylık Özelleştirme</SecTitle>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <div style={{minWidth:500}}>
              {/* Header */}
              <div style={{display:"grid",gridTemplateColumns:"26px 50px 90px 60px 80px 90px",background:"#1C3A5E",padding:"6px 4px",borderRadius:"6px 6px 0 0"}}>
                {["Ay","Tarih","Sabit Tutar","Ödeme Yapma","Ara Ödeme","Hesap. Taksit"].map((h,i)=>(
                  <span key={i} style={{fontSize:8,fontWeight:800,color:"#fff",textAlign:"center",padding:"0 2px",whiteSpace:"pre-line",lineHeight:1.3}}>{h}</span>
                ))}
              </div>
              {/* Rows */}
              {Array.from({length:V},(_,idx)=>idx+1).map(ay=>{
                const r=plan.find(r=>r.ay===ay);
                const atla=odemeYapma[ay]||false;
                return(
                  <div key={ay} style={{display:"grid",gridTemplateColumns:"26px 50px 90px 60px 80px 90px",padding:"4px",
                    background:atla?"rgba(248,113,113,0.15)":r?.ekstra>0?"rgba(224,165,61,0.18)":r?.sabit>0?"rgba(91,155,216,0.15)":ay%2===0?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.02)",
                    borderBottom:"1px solid rgba(255,255,255,0.1)",
                    borderLeft:atla?"3px solid #FF3B30":r?.ekstra>0?"3px solid #FFB800":r?.sabit>0?"3px solid #5B9BD8":"none"}}>
                    <span style={{fontSize:10,color:atla?"#FF3B30":C.sub,textAlign:"center",fontWeight:700,alignSelf:"center"}}>{ay}</span>
                    <span style={{fontSize:9,color:C.sub,textAlign:"center",alignSelf:"center"}}>{MONTHS[(new Date().getMonth()+ay)%12]}</span>
                    {/* Sabit Tutar */}
                    <div style={{padding:"0 2px"}}>
                      <input inputMode="decimal" value={sabitTutar[ay]||""} disabled={atla}
                        onChange={e=>setSabitTutar(p=>({...p,[ay]:e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,"")}))}
                        placeholder="Opsiyonel"
                        style={{width:"100%",boxSizing:"border-box",padding:"4px 6px",fontSize:10,fontFamily:"monospace",
                          background:atla?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,borderRadius:5,
                          color:"#F1F5F9",outline:"none",textAlign:"right"}}/>
                    </div>
                    {/* Toggle */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div onClick={()=>setOdemeYapma(p=>({...p,[ay]:!p[ay]}))} style={{
                        width:36,height:20,borderRadius:10,
                        background:atla?"#FF3B30":"#34C759",
                        cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0
                      }}>
                        <div style={{
                          position:"absolute",top:2,left:atla?2:16,width:16,height:16,
                          borderRadius:8,background:"#fff",transition:"left 0.2s",
                          boxShadow:"0 1px 2px rgba(0,0,0,0.3)"
                        }}/>
                      </div>
                    </div>
                    {/* Ara Ödeme */}
                    <div style={{padding:"0 2px"}}>
                      <input inputMode="decimal" value={araOdeme[ay]||""} disabled={atla}
                        onChange={e=>setAraOdeme(p=>({...p,[ay]:e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,"")}))}
                        placeholder="Ekstra"
                        style={{width:"100%",boxSizing:"border-box",padding:"4px 6px",fontSize:10,fontFamily:"monospace",
                          background:atla?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.06)",border:`1px solid ${C.border}`,borderRadius:5,
                          color:"#F1F5F9",outline:"none",textAlign:"right"}}/>
                    </div>
                    {/* Hesaplanan Taksit */}
                    <span style={{fontSize:10,fontWeight:700,color:atla?"#FF3B30":C.blue,fontFamily:"monospace",textAlign:"right",alignSelf:"center",padding:"0 4px"}}>
                      {atla?"—":r?`₺${fmt2(r.taksit)}`:`₺${fmt2(stdTaksit)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {plan&&plan.length>0&&onGecmis&&<GecmisKaydetButon onGecmis={onGecmis} kayit={{modul:"Esnek Ödemeli Plan",tutar:`₺${fmt2(T)}`,vade:V+" Ay",oran:oran+"% ("+oranTip+")",sonuc:`₺${fmt2(plan.reduce((s,r)=>s+r.taksit,0))}`,netGetiri:`₺${fmt2(plan.reduce((s,r)=>s+r.kp,0))}`,aylikTaksit:`₺${fmt2(stdTaksit)}`,plan:[]}}/>}
      {plan&&<>
        <Card>
          <SecTitle>Özet</SecTitle>
          <RRow label="Finansman Tutarı" value={`₺${fmt2(T)}`}/>
          <RRow label="Standart Taksit" value={`₺${fmt2(stdTaksit)}`}/>
          <RRow label="Toplam Geri Ödeme" value={`₺${fmt2(toplamTaksit)}`} accent={C.blue} big/>
          <RRow label="Toplam Kâr Payı" value={`₺${fmt2(toplamKP)}`} accent={C.orange}/>
          <RRow label="Toplam BSMV (%5)" value={`₺${fmt2(toplamBsmv)}`} sub/>
          {Object.values(odemeYapma).some(v=>v)&&<RRow label="Atlanan Ay" value={`${Object.values(odemeYapma).filter(v=>v).length} ay`} accent={C.red} sub/>}
        </Card>
        <Card>
          <SecTitle>Ödeme Planı</SecTitle>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginTop:8}}>
            <div style={{minWidth:480}}>
              <div style={{display:"grid",gridTemplateColumns:"24px 55px 1fr 1fr 1fr 1fr 1fr",background:"#1C3A5E",padding:"6px 4px"}}>
                {["#","Tarih","Taksit","Anapara","Kâr Payı","BSMV","Kalan"].map((h,i)=>(
                  <span key={i} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:i>1?"right":"center",padding:"0 2px"}}>{h}</span>
                ))}
              </div>
              <div style={{maxHeight:320,overflowY:"auto"}}>
                {plan.map((r,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"24px 55px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",
                    background:r.atla?"rgba(248,113,113,0.15)":r.ekstra>0?"rgba(224,165,61,0.18)":r.sabit>0?"rgba(91,155,216,0.15)":i%2===0?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.02)",
                    borderBottom:"1px solid rgba(255,255,255,0.1)",
                    borderLeft:r.atla?"3px solid #FF3B30":r.ekstra>0?"3px solid #FFB800":r.sabit>0?"3px solid #5B9BD8":"none"}}>
                    <span style={{fontSize:9,color:r.atla?"#FF3B30":"#6B7280",textAlign:"center",fontWeight:700}}>{r.ay}</span>
                    <span style={{fontSize:9,color:"#6B7280",textAlign:"center"}}>{r.tarih}</span>
                    {[r.taksit,r.anapara,r.kp,r.bsmv,r.bakiye].map((v,vi)=>(
                      <span key={vi} style={{fontSize:9,color:r.atla?"#FF3B30":"#F1F5F9",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>
                        {r.atla&&vi===0?"ATLA":fmt2(v)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"24px 55px 1fr 1fr 1fr 1fr 1fr",padding:"5px 4px",background:"#1C3A5E"}}>
                <span style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"center"}}>∑</span>
                <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>—</span>
                {[toplamTaksit,plan.reduce((s,r)=>s+r.anapara,0),toplamKP,toplamBsmv,"—"].map((v,vi)=>(
                  <span key={vi} style={{fontSize:9,fontWeight:800,color:"#fff",textAlign:"right",fontFamily:"monospace",padding:"0 2px"}}>{typeof v==="number"?fmt2(v):v}</span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </>}
    </div>
  );
}

// ─── ORAN KARŞILAŞTIRMA ─────────────────────────────────────────────────────
// Haftalık (frequency=8) ve Aylık Stok (frequency=9) EVDS verileri
// Tüm hücreler dolu — haftalık yoksa stok kullanılır ve işaretlenir

const OC_HAFTALIK:{[id:string]:{[s:string]:string}} = {
  tum:     { konut:"TP.KTF10",  tasit:"TP.KTF11",  ihtiyac:"TP.KTF12",  ticariTL:"TP.KTF1",    ticariUSD:"TP.KTF1.USD",   ticariEUR:"TP.KTF1.EUR"   },
  kamu:    { konut:"TP.KTF101", tasit:"TP.KTF111", ihtiyac:"TP.KTF121", ticariTL:"TP.KTF1.K",  ticariUSD:"TP.KTF1.K.USD", ticariEUR:"TP.KTF1.K.EUR" },
  mevduat: { konut:"TP.KTF10",  tasit:"TP.KTF11",  ihtiyac:"TP.KTF12",  ticariTL:"TP.KTF1",    ticariUSD:"TP.KTF1.USD",   ticariEUR:"TP.KTF1.EUR"   },
  katilim: { konut:"TP.KTF17",  tasit:"TP.KTF171", ihtiyac:"TP.KTF172", ticariTL:"TP.KTF17.TL",ticariUSD:"TP.KTF17.USD",  ticariEUR:"TP.KTF17.EUR"  },
};

const OC_STOK:{[id:string]:{[s:string]:string}} = {
  tum:     { konut:"TP_BKR_TRY_KTF10",  tasit:"TP_BKR_TRY_17", ihtiyac:"TP_BKR_TRY_18", ticariTL:"TP_BKR_TRY_1",    ticariUSD:"TP_BKR_USD_1",      ticariEUR:"TP_BKR_EUR_1"     },
  kamu:    { konut:"TP_KBK_TRY_KBTF10", tasit:"TP_KBK_TRY_17", ihtiyac:"TP_KBK_TRY_18", ticariTL:"TP_KBK_TRY_1",    ticariUSD:"TP_KBK_USD_KBTF17", ticariEUR:"TP_KBK_EUR_KBTF17"},
  mevduat: { konut:"TP_BKR_TRY_KTF10",  tasit:"TP_BKR_TRY_17", ihtiyac:"TP_BKR_TRY_18", ticariTL:"TP_BKR_TRY_1",    ticariUSD:"TP_BKR_USD_1",      ticariEUR:"TP_BKR_EUR_1"     },
  katilim: { konut:"TP_KKP_TRY_KTF10",  tasit:"TP_KKP_TRY_17", ihtiyac:"TP_KKP_TRY_18", ticariTL:"TP_KKP_TRY_1",    ticariUSD:"TP_KKP_USD_KTF17",  ticariEUR:"TP_KKP_EUR_KTF17" },
};

const OC_SATIRLAR = [
  { id:"tum",     label:"Tüm Bankalar",      icon:"🏦", renk:"#5B9BD8", bg:"rgba(91,155,216,0.15)" },
  { id:"kamu",    label:"Kamu Bankaları",    icon:"🏛️", renk:"#1565C0", bg:"#E3F2FD" },
  { id:"mevduat", label:"Mevduat Bankaları", icon:"🏢", renk:"#4ADE80", bg:"rgba(74,222,128,0.15)" },
  { id:"katilim", label:"Katılım Bankaları", icon:"☪️", renk:"#B07D2E", bg:"#FBF5E8" },
];

const OC_SUTUNLAR = [
  { id:"konut",     label:"Konut",      icon:"🏠", renk:"#5B9BD8" },
  { id:"tasit",     label:"Taşıt",      icon:"🚗", renk:"#2A7A72" },
  { id:"ihtiyac",   label:"İhtiyaç",    icon:"💼", renk:"#5B4A8A" },
  { id:"ticariTL",  label:"Ticari ₺",   icon:"₺",  renk:"#8A2C2C" },
  { id:"ticariUSD", label:"Ticari $",   icon:"$",  renk:"#2C6E2C" },
  { id:"ticariEUR", label:"Ticari €",   icon:"€",  renk:"#2C4A8A" },
];

// ─── VADE & HATIRLATMA TAKİBİ ────────────────────────────────────────────────

const VT_TIP_ICON:any={katilim:"🏦",kredi:"💳",not:"📌"};
const VT_TIP_LABEL:any={katilim:"Katılım Hesabı",kredi:"Kredi / Taksit",not:"Hatırlatma Notu"};
const VT_STORAGE_KEY="katilimAnaliz_vadeTakibi_v1";

function vtBugunFark(vadeTarih:string):number{
  const bugun=new Date(); bugun.setHours(0,0,0,0);
  const vade=new Date(vadeTarih); vade.setHours(0,0,0,0);
  return Math.round((vade.getTime()-bugun.getTime())/86400000);
}
function vtFmtTarih(str:string):string{
  const AYLAR=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const d=new Date(str);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}
function vtDurumBilgi(k:any):{label:string,renk:string,bg:string}{
  const fark=vtBugunFark(k.vade);
  if(fark<0) return {label:`${Math.abs(fark)} gün geçti`,renk:"rgba(255,255,255,0.25)",bg:"transparent"};
  if(fark===0) return {label:"Bugün!",renk:"#FF6B6B",bg:"rgba(184,50,50,0.2)"};
  if(fark<=k.hatirlatmaGun) return {label:`${fark} gün kaldı`,renk:"#F59E0B",bg:"rgba(176,125,46,0.15)"};
  return {label:`${fark} gün kaldı`,renk:"rgba(255,255,255,0.45)",bg:"transparent"};
}

function VadeTakibi(){
  const [kayitlar,setKayitlar]=useState<any[]>(()=>{
    try{const s=localStorage.getItem(VT_STORAGE_KEY);return s?JSON.parse(s):[];}catch{return [];}
  });
  const [aktifSekme,setAktifSekme]=useState<"liste"|"ekle">("liste");
  const [secili,setSecili]=useState<string|null>(null);
  const [filtre,setFiltre]=useState("tumu");
  const [form,setForm]=useState({tip:"katilim",baslik:"",aciklama:"",tutar:"",para:"TL",vade:"",hatirlatmaGun:3});

  // localStorage'a kaydet
  useEffect(()=>{
    try{localStorage.setItem(VT_STORAGE_KEY,JSON.stringify(kayitlar));}catch{}
  },[kayitlar]);

  const uyarilar=kayitlar.filter(k=>{const f=vtBugunFark(k.vade);return f>=0&&f<=k.hatirlatmaGun;});
  const filtreli=[...kayitlar]
    .filter(k=>filtre==="tumu"||k.tip===filtre)
    .sort((a,b)=>new Date(a.vade).getTime()-new Date(b.vade).getTime());

  function kayitSil(id:string){
    setKayitlar(prev=>prev.filter(k=>k.id!==id));
    setSecili(null);
  }

  function formKaydet(){
    if(!form.baslik||!form.vade) return;
    const yeni={
      id:Date.now().toString(),
      tip:form.tip, baslik:form.baslik, aciklama:form.aciklama,
      tutar:form.tutar?parseFloat(form.tutar):null,
      para:form.para,
      baslangic:new Date().toISOString().slice(0,10),
      vade:form.vade,
      hatirlatmaGun:parseInt(String(form.hatirlatmaGun))||0,
    };
    setKayitlar(prev=>[...prev,yeni]);
    setForm({tip:"katilim",baslik:"",aciklama:"",tutar:"",para:"TL",vade:"",hatirlatmaGun:3});
    setAktifSekme("liste");
  }

  const INP:any={width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px",color:"#E8F0FA",fontSize:12,outline:"none",boxSizing:"border-box"};

  return(
    <div style={{paddingBottom:32,background:"#0F1923",minHeight:"100dvh"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1A3A2A 0%,#2A5A3A 100%)",padding:"16px 16px 14px"}}>
        <p style={{margin:"0 0 2px",fontSize:11,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.07em"}}>Katılım Analiz</p>
        <h2 style={{margin:0,fontSize:18,fontWeight:800,color:"#fff"}}>Vade Takip & Hatırlatma Ajandam</h2>
        <p style={{margin:"4px 0 0",fontSize:11,color:"rgba(255,255,255,0.55)"}}>
          {kayitlar.length} kayıt{uyarilar.length>0?` · ⚠️ ${uyarilar.length} uyarı`:""}
        </p>
      </div>

      {/* Uyarı bandı */}
      {uyarilar.length>0&&(
        <div style={{background:"rgba(184,50,50,0.18)",borderBottom:"1px solid rgba(184,50,50,0.35)",padding:"8px 14px"}}>
          {uyarilar.map((u,i)=>{
            const fark=vtBugunFark(u.vade);
            return(
              <div key={u.id} onClick={()=>{setSecili(u.id);setAktifSekme("liste");setFiltre("tumu");}}
                style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0",cursor:"pointer",
                  borderBottom:i<uyarilar.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                <span style={{fontSize:18,flexShrink:0}}>{fark===0?"🔔":"⏰"}</span>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:12,fontWeight:700,color:fark===0?"#FF6B6B":"#F59E0B"}}>
                    {fark===0?"BUGÜN":`${fark} GÜN KALDI`} — {u.baslik}
                  </p>
                  <p style={{margin:"1px 0 0",fontSize:10,color:"rgba(255,255,255,0.5)"}}>
                    {vtFmtTarih(u.vade)}{u.tutar?` · ${u.tutar.toLocaleString("tr-TR")} ${u.para}`:""}
                  </p>
                </div>
                <span style={{fontSize:14,color:"rgba(255,255,255,0.25)"}}>›</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{padding:"10px 12px 0"}}>
        {/* Sekmeler */}
        <div style={{display:"flex",background:"#1A2633",borderRadius:12,padding:3,marginBottom:12,gap:3,border:"1px solid rgba(255,255,255,0.08)"}}>
          {([["liste","📋 Kayıtlar"],["ekle","➕ Yeni Ekle"]] as const).map(([s,l])=>(
            <button key={s} onClick={()=>setAktifSekme(s)} style={{
              flex:1,padding:"9px",borderRadius:9,border:"none",
              background:aktifSekme===s?"#2A5A3A":"transparent",
              color:aktifSekme===s?"#fff":"#9AAFC2",
              fontWeight:aktifSekme===s?700:600,fontSize:12,cursor:"pointer",
            }}>{l}</button>
          ))}
        </div>

        {/* LİSTE */}
        {aktifSekme==="liste"&&(<>
          {/* Filtre */}
          <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto"}}>
            {([["tumu","Tümü"],["katilim","🏦 Katılım"],["kredi","💳 Kredi"],["not","📌 Not"]] as const).map(([v,l])=>(
              <button key={v} onClick={()=>setFiltre(v)} style={{
                padding:"6px 14px",borderRadius:20,border:filtre===v?"none":"1px solid rgba(255,255,255,0.15)",whiteSpace:"nowrap",
                background:filtre===v?"#2A5A3A":"#1A2633",
                color:filtre===v?"#fff":"#9AAFC2",
                fontWeight:filtre===v?700:600,fontSize:11,cursor:"pointer",
              }}>{l}</button>
            ))}
          </div>

          {filtreli.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:"#9AAFC2"}}>
              <p style={{fontSize:32,margin:"0 0 8px"}}>📭</p>
              <p style={{fontSize:13,fontWeight:600}}>Henüz kayıt yok</p>
              <button onClick={()=>setAktifSekme("ekle")} style={{marginTop:10,padding:"8px 20px",borderRadius:20,border:"none",background:"#2A5A3A",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>➕ İlk Kaydı Ekle</button>
            </div>
          ):(
            filtreli.map(k=>{
              const fark=vtBugunFark(k.vade);
              const durum=vtDurumBilgi(k);
              const gecti=fark<0;
              const acik=secili===k.id;
              return(
                <div key={k.id} onClick={()=>setSecili(acik?null:k.id)} style={{
                  background:"#1A2633",borderRadius:14,padding:"12px 14px",marginBottom:8,cursor:"pointer",
                  border:`1px solid ${fark>=0&&fark<=k.hatirlatmaGun?"rgba(184,50,50,0.4)":"rgba(255,255,255,0.08)"}`,
                  opacity:gecti?0.5:1,
                  borderLeft:`4px solid ${k.tip==="katilim"?"#5B9BD8":k.tip==="kredi"?"#B07D2E":"#6B4FA0"}`,
                }}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <span style={{fontSize:20,flexShrink:0}}>{VT_TIP_ICON[k.tip]}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <p style={{margin:0,fontSize:13,fontWeight:700,color:"#E8F0FA",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k.baslik}</p>
                        <span style={{fontSize:10,fontWeight:700,color:durum.renk,background:durum.bg,borderRadius:6,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>
                          {durum.label}
                        </span>
                      </div>
                      {k.aciklama&&<p style={{margin:"3px 0 0",fontSize:11,color:"rgba(255,255,255,0.45)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k.aciklama}</p>}
                      <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px",marginTop:5}}>
                        <span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>📅 {vtFmtTarih(k.vade)}</span>
                        {k.tutar&&<span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>💰 {k.tutar.toLocaleString("tr-TR")} {k.para}</span>}
                        <span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>⏰ {k.hatirlatmaGun===0?"Sadece vadede":`${k.hatirlatmaGun} gün önce`}</span>
                      </div>
                    </div>
                  </div>
                  {acik&&(
                    <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                        {[
                          ["Tür",VT_TIP_LABEL[k.tip]],
                          ["Vade",vtFmtTarih(k.vade)],
                          ...(k.tutar?[["Tutar",`${k.tutar.toLocaleString("tr-TR")} ${k.para}`]]:[]),
                          ["Uyarı",k.hatirlatmaGun===0?"Sadece vadede":`${k.hatirlatmaGun} gün önce`],
                        ].map(([l,v])=>(
                          <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"8px 10px"}}>
                            <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>{l}</p>
                            <p style={{margin:"2px 0 0",fontSize:11,fontWeight:700,color:"#E8F0FA"}}>{v}</p>
                          </div>
                        ))}
                      </div>
                      <button onClick={e=>{e.stopPropagation();kayitSil(k.id);}} style={{
                        width:"100%",padding:"8px",borderRadius:8,
                        border:"1px solid rgba(184,50,50,0.4)",background:"rgba(184,50,50,0.15)",
                        color:"#FF6B6B",fontSize:12,fontWeight:700,cursor:"pointer",
                      }}>🗑️ Kaydı Sil</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>)}

        {/* YENİ EKLE */}
        {aktifSekme==="ekle"&&(
          <div style={{background:"#1A2633",borderRadius:14,padding:16}}>
            <p style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"#E8F0FA"}}>Yeni Kayıt</p>

            {/* Tip */}
            <p style={{margin:"0 0 6px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Tür</p>
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              {([["katilim","🏦","Katılım"],["kredi","💳","Kredi"],["not","📌","Not"]] as const).map(([v,ic,l])=>(
                <button key={v} onClick={()=>setForm(f=>({...f,tip:v}))} style={{
                  flex:1,padding:"8px 4px",borderRadius:10,
                  border:`1px solid ${form.tip===v?"#2A5A3A":"rgba(255,255,255,0.08)"}`,
                  background:form.tip===v?"rgba(42,90,58,0.3)":"transparent",
                  color:form.tip===v?"#4ADE80":"rgba(255,255,255,0.45)",
                  fontSize:10,fontWeight:700,cursor:"pointer",textAlign:"center",
                }}><div style={{fontSize:18,marginBottom:2}}>{ic}</div>{l}</button>
              ))}
            </div>

            {/* Başlık */}
            <p style={{margin:"0 0 5px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Başlık *</p>
            <input value={form.baslik} onChange={e=>setForm(p=>({...p,baslik:e.target.value}))}
              placeholder={form.tip==="katilim"?"ör. 3 Aylık TL — Kuveyt Türk":form.tip==="kredi"?"ör. Konut Son Taksit":"ör. ZK Kontrol"}
              style={{...INP,marginBottom:10}}/>

            {/* Açıklama */}
            <p style={{margin:"0 0 5px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Açıklama</p>
            <input value={form.aciklama} onChange={e=>setForm(p=>({...p,aciklama:e.target.value}))}
              placeholder="İsteğe bağlı not" style={{...INP,marginBottom:10}}/>

            {/* Tutar (not tipinde gizle) */}
            {form.tip!=="not"&&(<>
              <p style={{margin:"0 0 5px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Tutar (isteğe bağlı)</p>
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                <input
                  value={form.tutar?Number(form.tutar.replace(/\./g,"")).toLocaleString("tr-TR"):""}
                  onChange={e=>{
                    const ham=e.target.value.replace(/\./g,"").replace(/[^0-9]/g,"");
                    setForm(p=>({...p,tutar:ham}));
                  }}
                  inputMode="numeric"
                  placeholder="0" style={{...INP,flex:1}}/>
                <select value={form.para} onChange={e=>setForm(p=>({...p,para:e.target.value}))}
                  style={{width:72,background:"#1A2633",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 6px",color:"#E8F0FA",fontSize:12,outline:"none"}}>
                  {["TL","USD","EUR","Altın"].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </>)}

            {/* Vade */}
            <p style={{margin:"0 0 5px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{form.tip==="not"?"Tarih *":"Vade Tarihi *"}</p>
            <input value={form.vade} onChange={e=>setForm(p=>({...p,vade:e.target.value}))}
              type="date" lang="tr" style={{...INP,marginBottom:12,colorScheme:"dark"}}/>

            {/* Uyarı günü */}
            <p style={{margin:"0 0 6px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Kaç gün önce uyarı?</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              {[0,1,3,5,7,14].map(g=>(
                <button key={g} onClick={()=>setForm(p=>({...p,hatirlatmaGun:g}))} style={{
                  padding:"6px 12px",borderRadius:20,
                  border:`1px solid ${form.hatirlatmaGun===g?"#2A5A3A":"rgba(255,255,255,0.08)"}`,
                  background:form.hatirlatmaGun===g?"rgba(42,90,58,0.3)":"transparent",
                  color:form.hatirlatmaGun===g?"#4ADE80":"rgba(255,255,255,0.4)",
                  fontSize:11,fontWeight:form.hatirlatmaGun===g?700:500,cursor:"pointer",
                }}>{g===0?"Sadece vadede":`${g} gün`}</button>
              ))}
            </div>

            <button onClick={formKaydet} disabled={!form.baslik||!form.vade} style={{
              width:"100%",padding:"12px",borderRadius:10,border:"none",
              background:!form.baslik||!form.vade?"rgba(255,255,255,0.08)":"#2A5A3A",
              color:!form.baslik||!form.vade?"rgba(255,255,255,0.3)":"#fff",
              fontSize:13,fontWeight:700,cursor:!form.baslik||!form.vade?"not-allowed":"pointer",
            }}>💾 Kaydet</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FİNANSAL TAKVİM ────────────────────────────────────────────────────────
function FinansalTakvim(){
  const [filtre,setFiltre]=useState("tumu");
  const bugun=new Date(); bugun.setHours(0,0,0,0);

  // ZK tarihleri: 19 Haz 2026 başlangıç, 2 haftada bir Cuma
  const zkTarihleri=[];
  const zkStart=new Date(2026,5,19); // 19 Haziran 2026
  for(let i=0;i<40;i++){
    const t=new Date(zkStart);
    t.setDate(zkStart.getDate()+i*14);
    if(t.getFullYear()>2027) break;
    zkTarihleri.push(t);
  }

  // PPK tarihleri 2026 (TCMB resmi)
  const PPK_2026=[
    new Date(2026,0,22),new Date(2026,2,12),new Date(2026,3,22),
    new Date(2026,5,11),new Date(2026,6,23),new Date(2026,8,10),
    new Date(2026,9,22),new Date(2026,11,10),
  ];

  // FED (FOMC) faiz kararı tarihleri 2026 (resmi takvim, karar 2. gün açıklanır)
  const FED_2026=[
    new Date(2026,0,28),new Date(2026,2,18),new Date(2026,3,29),
    new Date(2026,5,17),new Date(2026,6,29),new Date(2026,8,16),
    new Date(2026,9,28),new Date(2026,11,9),
  ];

  // TL Payı Rasyo: 03/07/2026 başlangıç, 8 haftada bir Cuma
  const tlPayiTarihleri=[];
  const tlStart=new Date(2026,6,3); // 3 Temmuz 2026
  for(let i=0;i<20;i++){
    const t=new Date(tlStart);
    t.setDate(tlStart.getDate()+i*56); // 8 hafta = 56 gün
    if(t.getFullYear()>2027) break;
    tlPayiTarihleri.push(t);
  }

  // Kredi Büyüme tarihleri: 17/07/2026 başlangıç, 8 haftada bir Cuma
  const krediTarihleri=[];
  const krediStart=new Date(2026,6,17); // 17 Temmuz 2026
  for(let i=0;i<20;i++){
    const t=new Date(krediStart);
    t.setDate(krediStart.getDate()+i*56); // 8 hafta = 56 gün
    if(t.getFullYear()>2027) break;
    krediTarihleri.push(t);
  }

  const tumEvents=[
    ...PPK_2026.map(t=>({tarih:t,tip:"ppk",label:"PPK Toplantısı",renk:"#9C3060",bg:"#FCE4EC",icon:"🏛️"})),
    ...FED_2026.map(t=>({tarih:t,tip:"fed",label:"FED (FOMC) Faiz Kararı",renk:"#1A3A6E",bg:"#E3EAF7",icon:"🇺🇸"})),
    ...zkTarihleri.map(t=>({tarih:t,tip:"zk",label:"ZK Hesaplama",renk:C.blue,bg:C.blueLight,icon:"📊"})),
    ...tlPayiTarihleri.map(t=>({tarih:t,tip:"tlpayi",label:"TL Payı Rasyo Hesaplama",renk:C.green,bg:C.greenLight,icon:"📈"})),
    ...krediTarihleri.map(t=>({tarih:t,tip:"kredi",label:"Kredi Büyüme Hesaplama",renk:C.orange,bg:C.orangeLight,icon:"💳"})),
  ]
  .filter(e=>e.tarih>=bugun)
  .sort((a,b)=>a.tarih-b.tarih);

  const filtreliEvents=filtre==="tumu"?tumEvents:tumEvents.filter(e=>e.tip===filtre);

  const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const DAYS=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
  const formatTarih=(d)=>`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${DAYS[d.getDay()]}`;
  const kalanGun=(d)=>{
    const diff=Math.round((d-bugun)/(1000*60*60*24));
    if(diff===0)return{text:"Bugün",renk:"#F87171"};
    if(diff===1)return{text:"Yarın",renk:C.orange};
    if(diff<=7)return{text:`${diff} gün`,renk:C.orange};
    return{text:`${diff} gün`,renk:C.sub};
  };

  const FILTRELER=[
    {v:"tumu",l:"Tümü",renk:"#1C3A5E"},
    {v:"ppk",l:"PPK",renk:"#9C3060",icon:"🏛️"},
    {v:"fed",l:"FED",renk:"#1A3A6E",icon:"🇺🇸"},
    {v:"zk",l:"ZK",renk:C.blue,icon:"📊"},
    {v:"tlpayi",l:"TL Payı",renk:C.green,icon:"📈"},
    {v:"kredi",l:"Kredi Büyüme",renk:C.orange,icon:"💳"},
  ];

  const yaklasan=tumEvents.filter(e=>Math.round((e.tarih-bugun)/(1000*60*60*24))<=7).length;

  return(
    <div style={{padding:"0 16px 32px"}}>
      {yaklasan>0&&<div style={{background:"rgba(224,165,61,0.18)",borderRadius:12,padding:"10px 14px",marginBottom:14,border:"1px solid #F59E0B",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:18}}>⚠️</span>
        <p style={{margin:0,fontSize:13,color:"#92400E",fontWeight:700}}>Önümüzdeki 7 günde {yaklasan} önemli tarih var</p>
      </div>}
      <div style={{display:"flex",gap:8,marginBottom:18,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
        {FILTRELER.map(f=>(
          <button key={f.v} onClick={()=>setFiltre(f.v)} style={{
            padding:"11px 18px",borderRadius:24,border:"none",cursor:"pointer",
            fontWeight:700,fontSize:14,whiteSpace:"nowrap",flexShrink:0,
            background:filtre===f.v?f.renk:"rgba(91,155,216,0.10)",
            color:filtre===f.v?"#fff":C.sub,
            boxShadow:filtre===f.v?"0 3px 10px rgba(0,0,0,0.15)":"none",
          }}>{f.icon?f.icon+" ":""}{f.l}</button>
        ))}
      </div>
      {filtreliEvents.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:C.sub}}>
        <p style={{fontSize:36,margin:"0 0 8px"}}>📅</p>
        <p style={{fontSize:14,fontWeight:600}}>Bu kategoride yaklaşan tarih yok</p>
      </div>}
      {filtreliEvents.map((e,i)=>{
        const kg=kalanGun(e.tarih);
        const oncekiAy=i===0?-1:filtreliEvents[i-1].tarih.getMonth();
        const yeniAy=oncekiAy!==e.tarih.getMonth();
        return(
          <div key={i}>
            {yeniAy&&<p style={{fontSize:12,fontWeight:800,color:C.sub,textTransform:"uppercase",letterSpacing:"0.08em",margin:"16px 0 8px"}}>{MONTHS[e.tarih.getMonth()]} {e.tarih.getFullYear()}</p>}
            <div style={{display:"flex",alignItems:"center",gap:12,background:C.card,borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",borderLeft:`4px solid ${e.renk}`}}>
              <div style={{width:40,height:40,borderRadius:10,background:e.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                {e.icon}
              </div>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:14,fontWeight:700,color:"#F1F5F9"}}>{e.label}</p>
                <p style={{margin:"2px 0 0",fontSize:12,color:C.sub}}>{formatTarih(e.tarih)}</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:kg.renk}}>{kg.text}</p>
                <p style={{margin:"1px 0 0",fontSize:10,color:C.sub}}>kaldı</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ─── TM KOMİSYON ─────────────────────────────────────────────────────────────
function TmKomisyon(){
  const [tutar,setTutar]=useState("");
  const [oran,setOran]=useState("");
  const [vade,setVade]=useState("");
  const [odeme,setOdeme]=useState("aylik");
  const [bsmvMuaf,setBsmvMuaf]=useState(false);

  const r=useCallback(()=>{
    const T=parseFloat(tutar),rt=parseFloat(oran),G=parseInt(vade);
    if(!T||!rt||!G)return null;
    // Yıllık oran üzerinden gün bazlı hesap (360)
    const gunlukOran=rt/100/365;
    const toplamKomisyon=Math.round(T*gunlukOran*G*100)/100;

    let plan=[];
    if(odeme==="aylik"){
      // Aylık: her 30 günde bir eşit taksit
      const aylik=Math.ceil(G/30);
      const aylikTutar=Math.round(toplamKomisyon/aylik*100)/100;
      for(let i=1;i<=aylik;i++){
        plan.push({donem:`${i}. Ay`,tutar:i===aylik?toplamKomisyon-(aylikTutar*(aylik-1)):aylikTutar,gun:Math.min(i*30,G)});
      }
    } else if(odeme==="uc_aylik"){
      // 3 aylık: her 90 günde bir
      const donem=Math.ceil(G/90);
      const donemTutar=Math.round(toplamKomisyon/donem*100)/100;
      for(let i=1;i<=donem;i++){
        plan.push({donem:`${i}. Çeyrek`,tutar:i===donem?toplamKomisyon-(donemTutar*(donem-1)):donemTutar,gun:Math.min(i*90,G)});
      }
    } else {
      // Flat: tek seferinde
      plan=[{donem:"Vade Sonu",tutar:toplamKomisyon,gun:G}];
    }
    const bsmvOran = bsmvMuaf ? 0 : 0.05;
    const bsmv = Math.round(toplamKomisyon * bsmvOran * 100) / 100;
    const toplamMaliyet = Math.round((toplamKomisyon + bsmv) * 100) / 100;
    // Plan satırlarına da BSMV ekle (muafsa 0)
    plan = plan.map(p=>({...p, bsmv:Math.round(p.tutar*bsmvOran*100)/100, toplam:Math.round(p.tutar*(1+bsmvOran)*100)/100}));
    return{toplamKomisyon,bsmv,toplamMaliyet,plan,gunlukKomisyon:T*gunlukOran};
  },[tutar,oran,vade,odeme,bsmvMuaf])();

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <Seg options={[{v:"aylik",l:"Aylık"},{v:"uc_aylik",l:"3 Aylık"},{v:"flat",l:"Flat"}]} value={odeme} onChange={setOdeme}/>
        <Field label="TM Tutarı" value={tutar} onChange={setTutar} suffix="₺"/>
        <Field label="Yıllık Komisyon Oranı" value={oran} onChange={setOran} suffix="%"/>
        <Field label="Vade (Gün)" value={vade} onChange={setVade} suffix="Gün"/>
        <div onClick={()=>setBsmvMuaf(v=>!v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 12px",marginTop:2,borderRadius:10,background:bsmvMuaf?C.greenLight:"rgba(255,255,255,0.04)",border:`1px solid ${bsmvMuaf?C.green:C.border}`,cursor:"pointer"}}>
          <div>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:bsmvMuaf?C.green:C.label}}>BSMV İstisnası</p>
            <p style={{margin:"2px 0 0",fontSize:11,color:C.sub}}>Teminat mektubu BSMV'den muafsa açın</p>
          </div>
          <div style={{width:44,height:26,borderRadius:13,background:bsmvMuaf?C.green:"rgba(255,255,255,0.15)",position:"relative",transition:"background 0.2s",flexShrink:0}}>
            <div style={{width:20,height:20,borderRadius:10,background:"#fff",position:"absolute",top:3,left:bsmvMuaf?21:3,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}/>
          </div>
        </div>
      </Card>
      {r&&<>
        <Card>
          <SecTitle>Teminat Mektubu Komisyon Özeti</SecTitle>
          <RRow label="Günlük Komisyon" value={fmtTL(r.gunlukKomisyon)} sub/>
          <RRow label="Toplam Komisyon" value={fmtTL(r.toplamKomisyon)} accent={C.blue} big/>
          <RRow label={bsmvMuaf?"BSMV (Muaf)":"BSMV (%5)"} value={fmtTL(r.bsmv)} sub accent={bsmvMuaf?C.green:C.red}/>
          <RRow label="Toplam Maliyet" value={fmtTL(r.toplamMaliyet)} accent={C.green} big/>
          <RRow label="Ödeme Şekli" value={odeme==="aylik"?"Aylık":odeme==="uc_aylik"?"3 Aylık":"Flat (Tek Seferinde)"} sub/>
        </Card>
        <Card>
          <SecTitle>Ödeme Planı</SecTitle>
          {r.plan.map((p,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:C.blue}}>{p.donem}</p>
                <p style={{margin:0,fontSize:11,color:C.sub}}>{p.gun}. gün · BSMV: {bsmvMuaf?"Muaf":fmtTL(p.bsmv)}</p>
              </div>
              <span style={{fontSize:15,fontFamily:"monospace",fontWeight:800,color:"#F1F5F9"}}>{fmtTL(p.toplam)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",marginTop:2}}>
            <span style={{fontSize:13,fontWeight:800,color:C.label}}>TOPLAM</span>
            <span style={{fontSize:15,fontFamily:"monospace",fontWeight:800,color:C.blue}}>{fmtTL(r.toplamMaliyet)}</span>
          </div>
        </Card>
      </>}
    </div>
  );
}

// ─── AKREDİTİF KOMİSYON ──────────────────────────────────────────────────────
// ─── SÖİK & REESKONT FİNANSMAN HESAPLAMA ────────────────────────────────────
const SOIK_VADELER = [
  {id:"180_1", label:"180 Gün — 1 Taksit", gun:180, taksit:1, oranKey:"soikOran_180_1tks"},
  {id:"360_4", label:"360 Gün — 4 Taksit", gun:360, taksit:4, oranKey:"soikOran_360_4tks"},
  {id:"540_6", label:"540 Gün — 6 Taksit", gun:540, taksit:6, oranKey:"soikOran_540_6tks"},
  {id:"720_8", label:"720 Gün — 8 Taksit", gun:720, taksit:8, oranKey:"soikOran_720_8tks"},
];
// Faizsiz Sevk Öncesi İhracatın Finansmanı — USD/EUR sabit oran tablosu (KOBİ / KOBİ Dışı)
// Taksitli vadelerde taksitler eşit aralıklarla vade sonuna kadar düşer (örn. 540/3 taksit → 180, 360, 540. gün)
const SOIK_DOVIZ_VADELER: {[key:string]: any[]} = {
  USD: [
    {id:"120_1",  label:"120 Gün — 1 Taksit",        gun:120, taksit:1, oranKobi:7.90, oranKobiDisi:8.40},
    {id:"180_1",  label:"180 Gün — 1 Taksit",        gun:180, taksit:1, oranKobi:7.90, oranKobiDisi:8.40},
    {id:"360_1F", label:"360 Gün — 1 Taksit (F)",    gun:360, taksit:1, oranKobi:8.40, oranKobiDisi:8.90},
    {id:"360_2",  label:"360 Gün — 2 Taksit",        gun:360, taksit:2, oranKobi:8.10, oranKobiDisi:8.60},
    {id:"540_2",  label:"540 Gün — 2 Taksit",        gun:540, taksit:2, oranKobi:8.40, oranKobiDisi:8.90},
    {id:"540_3",  label:"540 Gün — 3 Taksit",        gun:540, taksit:3, oranKobi:8.40, oranKobiDisi:8.90},
    {id:"720_3",  label:"720 Gün — 3 Taksit",        gun:720, taksit:3, oranKobi:8.60, oranKobiDisi:9.10},
    {id:"720_4",  label:"720 Gün — 4 Taksit",        gun:720, taksit:4, oranKobi:8.40, oranKobiDisi:8.90},
  ],
  EUR: [
    {id:"120_1",  label:"120 Gün — 1 Taksit",        gun:120, taksit:1, oranKobi:6.60, oranKobiDisi:7.10},
    {id:"180_1",  label:"180 Gün — 1 Taksit",        gun:180, taksit:1, oranKobi:6.60, oranKobiDisi:7.10},
    {id:"360_1F", label:"360 Gün — 1 Taksit (F)",    gun:360, taksit:1, oranKobi:7.10, oranKobiDisi:7.60},
    {id:"360_2",  label:"360 Gün — 2 Taksit",        gun:360, taksit:2, oranKobi:6.80, oranKobiDisi:7.30},
    {id:"540_2",  label:"540 Gün — 2 Taksit",        gun:540, taksit:2, oranKobi:7.10, oranKobiDisi:7.60},
    {id:"540_3",  label:"540 Gün — 3 Taksit",        gun:540, taksit:3, oranKobi:7.10, oranKobiDisi:7.60},
    {id:"720_3",  label:"720 Gün — 3 Taksit",        gun:720, taksit:3, oranKobi:7.40, oranKobiDisi:7.90},
    {id:"720_4",  label:"720 Gün — 4 Taksit",        gun:720, taksit:4, oranKobi:7.10, oranKobiDisi:7.60},
  ],
};
const REESKONT_VADELER = [
  {id:"90_1", label:"90 Gün — Tek Taksit", gun:90, taksit:1, oranKey:"reeskontOran_90", limitTL:60000000},
  {id:"180_1", label:"180 Gün — Tek Taksit", gun:180, taksit:1, oranKey:"reeskontOran_180", limitTL:60000000},
  {id:"360_1", label:"360 Gün — Tek Taksit", gun:360, taksit:1, oranKey:"reeskontOran_360", limitTL:60000000},
  {id:"720_1", label:"720 Gün — Tek Taksit", gun:720, taksit:1, oranKey:"reeskontOran_720", limitTL:60000000, savunmaSanayiSarti:true},
];

const REESKONT_KOMISYON_ORAN_YILLIK = 1; // %1 yıllık, vade gün bazında peşin tahsil edilir (360 gün baz)
const REESKONT_GUNLUK_LIMIT_TL = 60000000; // Firma bazlı aynı gün içinde kullanılabilecek azami tutar

const SOIK_REESKONT_KOMISYON_ORAN = 1; // Sabit %1 banka komisyonu (TRY) - değiştirilemez, peşin tahsil edilir
const SOIK_REESKONT_KOMISYON_ORAN_YP = 0.5; // YP (USD/EUR) SÖİK'te azami komisyon binde 5 (%0,5) - vadeye göre orantılı, peşin tahsil edilir
const SOIK_YP_AZAMI_TUTAR = 1000000; // SÖİK YP'de azami finansman tutarı: 1 Mio (USD veya EUR)
const SOIK_BSMV_ORAN = 5; // Sabit %5 BSMV - kâr payı üzerinden, her taksitte

function SoikReeskontHesaplama({s,onGecmis}:any){
  const [tur,setTur]=useState<"soik"|"reeskont">("soik");
  const [dovizTur,setDovizTur]=useState<"TRY"|"USD"|"EUR">("TRY");
  const [kobi,setKobi]=useState<"kobi"|"disi">("kobi");
  const [tutar,setTutar]=useState("");
  const [vadeId,setVadeId]=useState(SOIK_VADELER[0].id);
  const [showPlan,setShowPlan]=useState(false);
  const [bsmvMuaf,setBsmvMuaf]=useState(true); // varsayılan: BSMV muaf işaretli gelsin

  const dovizAktif = tur==="soik" && dovizTur!=="TRY";
  const vadeListesi = tur!=="soik" ? REESKONT_VADELER : (dovizAktif ? SOIK_DOVIZ_VADELER[dovizTur] : SOIK_VADELER);
  const seciliVade = vadeListesi.find(v=>v.id===vadeId) || vadeListesi[0];
  // oran = YILLIK kâr payı oranı (basit faiz, 360 gün baz)
  const yillikOran = dovizAktif
    ? (kobi==="kobi" ? (seciliVade as any).oranKobi : (seciliVade as any).oranKobiDisi)
    : ((s as any)[seciliVade.oranKey] ?? 0);

  const paraSembol = dovizTur==="USD"?"$":dovizTur==="EUR"?"€":"₺";
  const fmtDoviz = useCallback((n:number)=>isNaN(n)||n===null?"—":`${paraSembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`,[paraSembol]);

  useEffect(()=>{
    setVadeId(vadeListesi[0].id);
  },[tur,dovizTur]);

  const r = useCallback(()=>{
    const T = parseFloat(tutar);
    if(!T) return null;
    const gun = seciliVade.gun;
    const taksit = seciliVade.taksit;
    const taksitAraligi = Math.round(gun / taksit); // gün cinsinden taksit arası süre

    // SÖİK YP'de azami tutar aşılırsa hesaplama yapılmaz, sadece uyarı gösterilir
    if(tur==="soik" && dovizAktif && T > SOIK_YP_AZAMI_TUTAR){
      return {limitAsimi:true, gun, taksit, hesaplamaEngellendi:true};
    }

    if(tur==="reeskont"){
      // REESKONT: Kâr payı vade başında PEŞİN kesilir (basit, T üzerinden, gün/360 baz).
      // Banka komisyonu, kâr kesildikten sonraki NET bakiyeden, gün bazında peşin tahsil edilir.
      // BSMV yok (TCMB reeskont kaynaklı finansmanlarda BSMV istisnası standarttır).
      const toplamKarPayi = T * (yillikOran/100) * (gun/360);
      const netBakiyeKarSonrasi = T - toplamKarPayi;
      const komisyonFiiliOran = Math.min(REESKONT_KOMISYON_ORAN_YILLIK * (gun/360), REESKONT_KOMISYON_ORAN_YILLIK); // vadeye göre orantılı, azami %1
      const bankaKomisyonu = netBakiyeKarSonrasi * (komisyonFiiliOran/100);
      const netKullandirilan = netBakiyeKarSonrasi - bankaKomisyonu;
      const geriOdenecekToplam = T; // vade sonunda sadece nominal anapara geri ödenir
      const plan = [{
        ay: 1,
        karPayi: toplamKarPayi,
        anapara: netBakiyeKarSonrasi,
        vergi: 0,
        komisyon: bankaKomisyonu,
        toplam: T,
        bakiye: 0,
      }];
      const efektifOran = netKullandirilan > 0 ? ((toplamKarPayi + bankaKomisyonu) / netKullandirilan) * (360/gun) * 100 : yillikOran;
      const limitAsimi = T > REESKONT_GUNLUK_LIMIT_TL;

      return {
        tur, toplamKarPayi, toplamBsmv:0, bankaKomisyonu, netKullandirilan, komisyonFiiliOran,
        geriOdenecekAnapara: geriOdenecekToplam, taksitTutari: geriOdenecekToplam,
        taksitAraligi: gun, gun, taksit:1, oran: yillikOran, efektifOran, plan,
        pesinKesinti:true, limitAsimi,
      };
    }

    // SÖİK: Azalan bakiye üzerinden taksit taksit kâr payı + BSMV hesabı (yıllık oran, 360 gün baz)
    const anaparaTaksit = T / taksit;
    // YP'de komisyon oranı vadeye göre orantılı düşer (azami binde 5, 360 gün ve üzeri vadede tam oran).
    // TRY'de sabit %1 kalır (değişmiyor).
    const komisyonOran = dovizAktif
      ? Math.min(SOIK_REESKONT_KOMISYON_ORAN_YP * (gun/360), SOIK_REESKONT_KOMISYON_ORAN_YP)
      : SOIK_REESKONT_KOMISYON_ORAN;
    const bankaKomisyonu = T * (komisyonOran/100); // peşin tahsil edilir, taksit planına dahil değil
    let kalan = T;
    let toplamKarPayi = 0, toplamBsmv = 0;
    const plan = Array.from({length:taksit},(_, i)=>{
      const kar = kalan * (yillikOran/100) * (taksitAraligi/360);
      const bsmv = bsmvMuaf ? 0 : kar * (SOIK_BSMV_ORAN/100);
      const toplamTaksit = anaparaTaksit + kar + bsmv;
      toplamKarPayi += kar; toplamBsmv += bsmv;
      const satir = {
        ay: i+1,
        karPayi: kar,
        anapara: anaparaTaksit,
        vergi: bsmv,
        komisyon: i===0?bankaKomisyonu:0,
        toplam: toplamTaksit,
        bakiye: kalan - anaparaTaksit,
      };
      kalan -= anaparaTaksit;
      return satir;
    });

    const taksitTutariOrtalama = plan.reduce((a,p)=>a+p.toplam,0)/taksit;
    const geriOdenecekToplam = T + toplamKarPayi + toplamBsmv;
    const netKullandirilan = T - bankaKomisyonu; // peşin alınan komisyon düşülerek kullanıma geçen tutar
    // Efektif YILLIK maliyet: toplam ödenen maliyet (kâr+BSMV+komisyon) / başlangıç anaparası, (360/gün) ile yıllıklandırılır.
    // Yıllıklandırma olmadan bu oran "Basit %X Yıllık" ile kıyaslanamaz hale gelir (farklı vadeler farklı birimde olur).
    // Not: çok taksitli planlarda anapara azalan bakiye üzerinden ödendiği için kâr payı kısmı,
    // basit yıllık orandan düşük çıkabilir — ama komisyon eklendiğinde toplam genelde basit orana yakın/üstünde olur.
    const efektifOran = T > 0
      ? ((toplamKarPayi + toplamBsmv + bankaKomisyonu) / T) * (360/gun) * 100
      : yillikOran;

    return {
      tur, toplamKarPayi, toplamBsmv, bankaKomisyonu, netKullandirilan, komisyonOran,
      geriOdenecekAnapara: geriOdenecekToplam, taksitTutari: taksitTutariOrtalama,
      taksitAraligi, gun, taksit, oran: yillikOran, efektifOran, plan,
      pesinKesinti:false, limitAsimi: dovizAktif ? T > SOIK_YP_AZAMI_TUTAR : T > REESKONT_GUNLUK_LIMIT_TL,
    };
  },[tutar,seciliVade,yillikOran,tur,bsmvMuaf,dovizAktif])();

  return(
    <div style={{padding:"0 16px 32px"}}>
      {showPlan&&r?.plan&&<OdemePlani
        plan={r.plan}
        bsmvOran={bsmvMuaf?0:SOIK_BSMV_ORAN}
        kkdfOran={0}
        onClose={()=>setShowPlan(false)}
        showKomisyon={true}
        basitOran={r.oran}
        efektifOran={r.efektifOran}
        anaparaTutar={parseFloat(tutar)}
        taksitAraligiGun={r.taksitAraligi}/>}

      <Card>
        <SecTitle>Finansman Türü</SecTitle>
        <Seg options={[{v:"soik",l:"SÖİK"},{v:"reeskont",l:"Reeskont Kredisi"}]} value={tur} onChange={setTur}/>
        <div style={{background:C.blueLight,borderRadius:8,padding:"8px 10px",marginTop:8}}>
          <p style={{margin:0,fontSize:11,color:C.blue,lineHeight:1.5}}>
            {tur==="soik"
              ? "SÖİK: Sevk Öncesi İhracatın Finansmanı — TCMB reeskont kaynaklı"
              : "Reeskont Kredisi: TCMB kaynaklı ihracat reeskont kredisi, 360 gün vadeli tek taksit"}
          </p>
        </div>
        {tur==="soik" && (
          <>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginTop:12,marginBottom:6}}>Para Birimi</label>
            <Seg options={[{v:"TRY",l:"TRY"},{v:"USD",l:"USD"},{v:"EUR",l:"EUR"}]} value={dovizTur} onChange={setDovizTur}/>
            {dovizAktif && (
              <>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginTop:8,marginBottom:6}}>İşletme Ölçeği</label>
                <Seg options={[{v:"kobi",l:"KOBİ"},{v:"disi",l:"KOBİ Dışı"}]} value={kobi} onChange={setKobi}/>
                <p style={{margin:"6px 0 0",fontSize:10,color:C.sub,lineHeight:1.5}}>Faizsiz Sevk Öncesi İhracatın Finansmanı — {dovizTur} sabit oran tablosu</p>
              </>
            )}
          </>
        )}
      </Card>

      <Card>
        <SecTitle>Finansman Bilgileri</SecTitle>
        <Field label={`Finansman Tutarı (${dovizTur})`} value={tutar} onChange={setTutar} suffix={paraSembol}/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginTop:10,marginBottom:6}}>Vade Seçimi</label>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {vadeListesi.map(v=>{
            const vOran = dovizAktif ? (kobi==="kobi" ? (v as any).oranKobi : (v as any).oranKobiDisi) : ((s as any)[(v as any).oranKey] ?? 0);
            return(
            <button key={v.id} onClick={()=>setVadeId(v.id)} style={{
              display:"flex",flexDirection:"column",gap:4,
              padding:"10px 14px",borderRadius:10,
              border:`1.5px solid ${vadeId===v.id?C.blue:C.border}`,
              background:vadeId===v.id?C.blueLight:C.card,
              cursor:"pointer",fontFamily:"inherit",textAlign:"left",
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:vadeId===v.id?700:500,color:vadeId===v.id?C.blue:C.label}}>{v.label}</span>
                <span style={{fontSize:13,fontWeight:700,color:vadeId===v.id?C.blue:C.sub}}>
                  %{vOran.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})} Yıllık
                </span>
              </div>
              {(v as any).savunmaSanayiSarti && (
                <span style={{alignSelf:"flex-start",fontSize:9,fontWeight:700,color:"#fff",background:C.red,padding:"2px 8px",borderRadius:6}}>🛡️ Savunma Sanayi</span>
              )}
            </button>
            );
          })}
        </div>
        {tur==="reeskont" && (seciliVade as any).savunmaSanayiSarti && (
          <div style={{marginTop:8,padding:"10px 14px",borderRadius:10,background:"rgba(248,113,113,0.12)",border:`1.5px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,lineHeight:1.5}}>🛡️ 360 günü aşan vadeler (720 gün) yalnızca Savunma Sanayi kapsamında faaliyet gösteren firmalara özeldir.</p>
          </div>
        )}
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginTop:14,marginBottom:6}}>Banka Komisyonu</label>
        <div style={{
          display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"10px 14px",borderRadius:10,
          border:`1.5px solid ${C.border}`,
          background:"rgba(255,255,255,0.05)",
        }}>
          <span style={{fontSize:13,fontWeight:500,color:C.sub}}>
            {tur==="reeskont" ? `Vadeye Göre (%${REESKONT_KOMISYON_ORAN_YILLIK} Yıllık, Gün Bazında — Net Bakiyeden Peşin)` : "Sabit Oran (Peşin Tahsil)"}
          </span>
          <span style={{fontSize:14,fontWeight:800,color:C.purple,whiteSpace:"nowrap",marginLeft:8}}>
            {tur==="reeskont" ? `%${fmtN(Math.min(REESKONT_KOMISYON_ORAN_YILLIK*(seciliVade.gun/360),REESKONT_KOMISYON_ORAN_YILLIK),4)}` : `%${fmtN(dovizAktif?Math.min(SOIK_REESKONT_KOMISYON_ORAN_YP*(seciliVade.gun/360),SOIK_REESKONT_KOMISYON_ORAN_YP):SOIK_REESKONT_KOMISYON_ORAN,2)}`}
          </span>
        </div>

        {tur==="soik" && (
          <button onClick={()=>setBsmvMuaf(v=>!v)} style={{
            width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"10px 14px",borderRadius:10,marginTop:10,
            border:`1.5px solid ${bsmvMuaf?C.green:C.border}`,
            background:bsmvMuaf?C.greenLight:"#fff",
            cursor:"pointer",fontFamily:"inherit",
          }}>
            <span style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{
                width:18,height:18,borderRadius:5,flexShrink:0,
                border:`1.5px solid ${bsmvMuaf?C.green:C.border}`,
                background:bsmvMuaf?C.green:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,color:"#fff",fontWeight:900,
              }}>{bsmvMuaf?"✓":""}</span>
              <span style={{fontSize:13,fontWeight:600,color:bsmvMuaf?C.green:C.label}}>BSMV Muafiyeti</span>
            </span>
            <span style={{fontSize:11,color:C.sub}}>{bsmvMuaf?"Muaf (BSMV alınmaz)":`%${SOIK_BSMV_ORAN} BSMV uygulanır`}</span>
          </button>
        )}
        {tur==="reeskont" && (
          <div style={{marginTop:10,padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:`1.5px solid ${C.border}`}}>
            <p style={{margin:0,fontSize:11,color:C.sub}}>TCMB reeskont kaynaklı finansmanlarda BSMV istisnası standart olarak uygulanır.</p>
          </div>
        )}
      </Card>

      {r && r.limitAsimi && (
        <div style={{margin:"0 0 12px",padding:"12px 14px",background:"rgba(248,113,113,0.12)",borderRadius:12,border:`1.5px solid ${C.red}`}}>
          <p style={{margin:0,fontSize:12,fontWeight:700,color:C.red}}>⚠️ {dovizAktif&&tur==="soik" ? "SÖİK YP Azami Tutar Sınırı Aşıldı" : "Firma Bazlı Günlük Kullanım Limiti Aşıldı"}</p>
          <p style={{margin:"4px 0 0",fontSize:11,color:C.red,lineHeight:1.5}}>
            {dovizAktif&&tur==="soik"
              ? `SÖİK YP finansmanında azami tutar ${fmtDoviz(SOIK_YP_AZAMI_TUTAR)} ile sınırlıdır.`
              : `TCMB destekli Eximbank ihracat finansmanında firma bazında aynı gün içinde kullanılabilecek azami tutar ${fmtTL(REESKONT_GUNLUK_LIMIT_TL)}'dir. Grup üyesi firmalarda risk varsa, firma sayısı kadar bu limit artabilir.`}
          </p>
        </div>
      )}

      {r && !r.limitAsimi && (
        <Card>
          <SecTitle>Hesaplama Sonucu</SecTitle>
          <RRow label="Finansman Tutarı (Anapara)" value={fmtDoviz(parseFloat(tutar)||0)}/>
          <RRow label="Vade" value={`${r.gun} Gün, ${r.taksit} Taksit`}/>
          <RRow label="Yıllık Kâr Oranı (Basit)" value={`%${fmtN(r.oran)}`}/>
          {r.pesinKesinti ? (
            <>
              <RRow label="Kâr Payı (Vade Başında Peşin Kesilir)" value={fmtDoviz(r.toplamKarPayi)} accent={C.orange}/>
              <RRow label={`Banka Komisyonu (%${fmtN(r.komisyonFiiliOran,4)} — Net Bakiyeden Peşin)`} value={fmtDoviz(r.bankaKomisyonu)} accent={C.purple} sub/>
              <RRow label="Müşteri Hesabına Geçen Net Tutar" value={fmtDoviz(r.netKullandirilan)} accent={C.blue} big/>
              <RRow label="Vade Sonu Geri Ödeme (Nominal Anapara)" value={fmtDoviz(r.geriOdenecekAnapara)} accent={C.green} big/>
            </>
          ) : (
            <>
              <RRow label={`Banka Komisyonu (%${fmtN(r.komisyonOran,2)} — Peşin)`} value={fmtDoviz(r.bankaKomisyonu)} accent={C.purple} sub/>
              <RRow label="Toplam Kâr Payı" value={fmtDoviz(r.toplamKarPayi)} accent={C.orange}/>
              <RRow label="Toplam Geri Ödeme (Anapara+Kâr+BSMV)" value={fmtDoviz(r.geriOdenecekAnapara)} accent={C.green} big/>
            </>
          )}
          <div style={{marginTop:8,padding:"12px 14px",background:"rgba(224,165,61,0.15)",borderRadius:12,border:`1.5px solid ${C.orange}`}}>
            <p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,color:C.sub,letterSpacing:"0.04em"}}>EFEKTİF MALİYET (TOPLAM ÖDEME / ANAPARA)</p>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <p style={{margin:0,fontSize:12,color:C.sub}}>Basit %{fmtN(r.oran)} yıllık → Gerçekleşen</p>
              <p style={{margin:0,fontSize:22,fontWeight:900,color:C.orange,fontFamily:"monospace"}}>%{fmtN(r.efektifOran,2)}</p>
            </div>
            <p style={{margin:"6px 0 0",fontSize:10,color:C.sub,lineHeight:1.5}}>
              {r.pesinKesinti
                ? "Kâr payı ve banka komisyonu vade başında peşin kesildiği için müşteri net bakiyeyi (T'den daha az) kullanır. Efektif oran, gerçekte kullanılan net bakiye üzerinden hesaplandığı için basit yıllık orandan belirgin şekilde yüksek çıkar — bu, peşin kesintili kredilerin gerçek maliyetidir."
                : r.taksit>1
                ? "Çok taksitli planlarda anapara her taksitte azaldığı için ortalama kullanılan bakiye, başlangıç anaparasından düşüktür. Bu yüzden gerçekleşen toplam maliyet oranı, basit yıllık orandan düşük görünebilir — bu beklenen ve doğru bir sonuçtur."
                : "Banka komisyonu vade başında peşin tahsil edildiği için gerçekleşen maliyet, basit orandan farklılaşır."}
            </p>
          </div>

          <button onClick={()=>setShowPlan(true)} style={{width:"100%",marginTop:12,padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:14,cursor:"pointer"}}>
            📅 Ödeme Planını Görüntüle
          </button>

          <RaporButon baslik={`${tur==="soik"?"SÖİK":"Reeskont Kredisi"}${dovizAktif?` (${dovizTur})`:""} Finansman Analizi`} plan={r.plan} satirlar={r.pesinKesinti ? [
            {label:"Finansman Tutarı (Anapara)", value:fmtDoviz(parseFloat(tutar)), big:true},
            {label:"Vade", value:`${r.gun} gün, tek taksit`},
            {label:"Yıllık Kâr Oranı (Basit)", value:`% ${fmtN(r.oran)}`},
            {label:"Kâr Payı (Vade Başında Peşin)", value:fmtDoviz(r.toplamKarPayi)},
            {label:`Banka Komisyonu (%${fmtN(r.komisyonFiiliOran,4)} — Net Bakiyeden)`, value:fmtDoviz(r.bankaKomisyonu)},
            {label:"Müşteri Hesabına Geçen Net Tutar", value:fmtDoviz(r.netKullandirilan), big:true},
            {label:"Vade Sonu Geri Ödeme (Nominal)", value:fmtDoviz(r.geriOdenecekAnapara), big:true},
            {label:"Efektif Yıllık Maliyet", value:`% ${fmtN(r.efektifOran,2)}`, big:true},
          ] : [
            {label:"Finansman Tutarı (Anapara)", value:fmtDoviz(parseFloat(tutar)), big:true},
            {label:"Vade", value:`${r.gun} gün, ${r.taksit} taksit`},
            {label:"Yıllık Kâr Oranı (Basit)", value:`% ${fmtN(r.oran)}`},
            {label:`Banka Komisyonu (%${fmtN(r.komisyonOran,2)} — Peşin)`, value:fmtDoviz(r.bankaKomisyonu)},
            {label:"Toplam Kâr Payı", value:fmtDoviz(r.toplamKarPayi)},
            {label:"Toplam BSMV", value:fmtDoviz(r.toplamBsmv)},
            {label:"Toplam Geri Ödeme", value:fmtDoviz(r.geriOdenecekAnapara), big:true},
            {label:`Ortalama Taksit Tutarı`, value:fmtDoviz(r.taksitTutari)},
            {label:"Efektif Yıllık Maliyet", value:`% ${fmtN(r.efektifOran,2)}`, big:true},
          ]}/>

          <button onClick={()=>{
            if(onGecmis && r){
              onGecmis({
                modul:(tur==="soik"?`SÖİK Finansmanı${dovizAktif?` (${dovizTur})`:""}`:"Reeskont Kredisi"),
                tutar:fmtDoviz(parseFloat(tutar)),
                vade:`${r.gun} Gün / ${r.taksit} Taksit`,
                oran:`Basit %${fmtN(r.oran)} / Efektif %${fmtN(r.efektifOran,2)}`,
                sonuc:fmtDoviz(r.geriOdenecekAnapara),
                netGetiri:fmtDoviz(r.toplamKarPayi),
                aylikTaksit:fmtDoviz(r.taksitTutari),
                plan:r.plan.map((p,i)=>({etiket:`${i+1}. Taksit`,tutar:fmtDoviz(p.toplam)})),
              });
            }
          }} style={{width:"100%",marginTop:8,padding:"10px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer"}}>
            🕐 Geçmişe Kaydet
          </button>
        </Card>
      )}
    </div>
  );
}

function AkreditifKomisyon(){
  const [doviz,setDoviz]=useState("USD");
  const [tutar,setTutar]=useState("");
  const [tolerans,setTolerans]=useState("10");
  const [acilisTarih,setAcilisTarih]=useState("");
  const [sonYuklemeTarih,setSonYuklemeTarih]=useState("");
  const [ibrazGun,setIbrazGun]=useState("21");
  const [komisyonOran,setKomisyonOran]=useState("");

  const DOVIZ_SEMBOL={TL:"₺",USD:"$",EUR:"€"};
  const sembol=DOVIZ_SEMBOL[doviz];
  const fmtDoviz=(n)=>isNaN(n)||n===null?"—":`${sembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`;

  const r=useCallback(()=>{
    const T=parseFloat(tutar);
    if(!T)return null;
    const tolOran=parseFloat(tolerans)||0;
    const maxTutar=Math.round(T*(1+tolOran/100)*100)/100;

    let vadeSuresi=null,ibrazSuresi=null,toplamVade=null,vadeBitis=null;
    if(acilisTarih&&sonYuklemeTarih){
      const ac=new Date(acilisTarih);
      const sy=new Date(sonYuklemeTarih);
      vadeSuresi=Math.round((sy-ac)/(1000*60*60*24));
      ibrazSuresi=parseInt(ibrazGun)||21;
      toplamVade=vadeSuresi+ibrazSuresi;
      vadeBitis=new Date(sy);
      vadeBitis.setDate(vadeBitis.getDate()+ibrazSuresi);
    }

    const oran=parseFloat(komisyonOran);
    if(!oran||!toplamVade)return{maxTutar,tolOran,vadeSuresi,ibrazSuresi,toplamVade,vadeBitis};

    const komisyon=Math.round(maxTutar*(oran/100/365)*toplamVade*100)/100;
    const bsmv=Math.round(komisyon*0.05*100)/100;
    const toplamMaliyet=Math.round((komisyon+bsmv)*100)/100;

    return{maxTutar,tolOran,vadeSuresi,ibrazSuresi,toplamVade,vadeBitis,komisyon,bsmv,toplamMaliyet,oran};
  },[tutar,tolerans,acilisTarih,sonYuklemeTarih,ibrazGun,komisyonOran])();

  const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const fmtDate=(d)=>d?`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`:"—";

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <div style={{marginBottom:8,padding:"8px 12px",background:C.blueLight,borderRadius:10}}>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:C.blue}}>🏦 İthalat Akreditifi</p>
        </div>
        <Seg options={[{v:"USD",l:"$ USD"},{v:"EUR",l:"€ EUR"},{v:"TL",l:"₺ TL"}]} value={doviz} onChange={setDoviz}/>
        <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:10}}>
          <Field label={`Akreditif Tutarı (${doviz})`} value={tutar} onChange={setTutar} suffix={sembol}/>
          <Field label="Tolerans" value={tolerans} onChange={setTolerans} suffix="%" hint="Std: %10"/>
        </div>
        {r?.maxTutar&&tutar&&<div style={{background:C.blueLight,borderRadius:10,padding:"9px 12px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.blue,fontWeight:600}}>Tolerans Dahil Azami Tutar</span>
          <span style={{fontSize:15,fontWeight:800,color:C.blue}}>{fmtDoviz(r.maxTutar)}</span>
        </div>}
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Akreditif Açılış Tarihi</label>
        <input type="date" value={acilisTarih} onChange={e=>setAcilisTarih(e.target.value)}
          style={{width:"100%",boxSizing:"border-box",padding:"11px 13px",fontSize:15,fontWeight:600,background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",marginBottom:13}}/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:4}}>Son Yükleme Tarihi</label>
        <input type="date" value={sonYuklemeTarih} onChange={e=>setSonYuklemeTarih(e.target.value)}
          style={{width:"100%",boxSizing:"border-box",padding:"11px 13px",fontSize:15,fontWeight:600,background:"rgba(255,255,255,0.06)",border:`1.5px solid ${C.border}`,borderRadius:10,color:"#F1F5F9",outline:"none",marginBottom:13}}/>
        <Field label="İbraz Süresi (Son yükleme + gün)" value={ibrazGun} onChange={setIbrazGun} suffix="Gün" hint="Standart: 21 gün"/>
        {r?.toplamVade&&<div style={{background:"rgba(91,155,216,0.10)",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12,color:C.sub}}>Akreditif Süresi</span>
            <span style={{fontSize:13,fontWeight:700,color:C.label}}>{r.vadeSuresi} gün</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12,color:C.sub}}>+ İbraz Süresi</span>
            <span style={{fontSize:13,fontWeight:700,color:C.label}}>{r.ibrazSuresi} gün</span>
          </div>
          <div style={{height:1,background:C.border,margin:"6px 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:700,color:C.label}}>Toplam Vade</span>
            <span style={{fontSize:14,fontWeight:800,color:C.blue}}>{r.toplamVade} gün</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:12,color:C.sub}}>Vade Bitiş Tarihi</span>
            <span style={{fontSize:12,fontWeight:700,color:C.orange}}>{fmtDate(r.vadeBitis)}</span>
          </div>
        </div>}
        <Field label="Komisyon Oranı (Yıllık %)" value={komisyonOran} onChange={setKomisyonOran} suffix="%"/>
      </Card>

      {r?.komisyon!==undefined&&<Card>
        <SecTitle>İthalat Akreditifi Komisyon Analizi ({doviz})</SecTitle>
        <RRow label="Akreditif Tutarı" value={fmtDoviz(parseFloat(tutar)||0)}/>
        <RRow label={`Tolerans (+%${r.tolOran})`} value={fmtDoviz(r.maxTutar-(parseFloat(tutar)||0))} sub accent={C.orange}/>
        <RRow label="Azami Tutar (Komisyon Bazı)" value={fmtDoviz(r.maxTutar)}/>
        <div style={{height:1,background:C.border,margin:"6px 0"}}/>
        <RRow label="Toplam Vade" value={`${r.toplamVade} gün`} sub/>
        <RRow label={`Komisyon (%${fmtN(r.oran,4)} × ${r.toplamVade} gün)`} value={fmtDoviz(r.komisyon)}/>
        <RRow label="BSMV (%5)" value={fmtDoviz(r.bsmv)} sub accent={C.red}/>
        <RRow label="Toplam Maliyet" value={fmtDoviz(r.toplamMaliyet)} accent={C.blue} big/>
      </Card>}
    </div>
  );
}

// ─── KATKI PAYI HESAPLAMA (0 FAİZLİ TAKSİT SÜBVANSİYONU) ───────────────────────
function KatkiPayiHesaplama(){
  const [tutar,setTutar]=useState("");
  const [yillikOran,setYillikOran]=useState("");
  const [taksitSayisi,setTaksitSayisi]=useState("12");
  const [showPlan,setShowPlan]=useState(false);

  const r=useMemo(()=>{
    const T=parseFloat(tutar.replace(",","."));
    const oran=parseFloat(yillikOran.replace(",","."));
    const taksit=parseInt(taksitSayisi);
    if(!T||!oran||!taksit) return null;

    const gun=taksit*30;
    const taksitAraligi=30;
    const aylikOran=(oran/100)*(taksitAraligi/360);

    // Eşit taksitli (PMT/annuite) yöntem
    const sabitTaksit = aylikOran===0
      ? T/taksit
      : T*(aylikOran*Math.pow(1+aylikOran,taksit))/(Math.pow(1+aylikOran,taksit)-1);

    let kalan=T;
    let toplamKatkiPayi=0;
    const plan=Array.from({length:taksit},(_,i)=>{
      const katki=kalan*aylikOran;
      const anapara=sabitTaksit-katki;
      toplamKatkiPayi+=katki;
      const satir={
        ay:i+1,
        karPayi:katki,
        anapara:anapara,
        vergi:0,
        komisyon:0,
        toplam:sabitTaksit,
        bakiye:kalan-anapara,
      };
      kalan-=anapara;
      return satir;
    });

    const katkiPayiOrani=(toplamKatkiPayi/T)*100;

    return {T,oran,taksit,gun,toplamKatkiPayi,katkiPayiOrani,plan,sabitTaksit};
  },[tutar,yillikOran,taksitSayisi]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <SecTitle>İşlem Bilgileri</SecTitle>
        <TutarField label="Finansman Tutarı" value={tutar} onChange={setTutar}/>
        <Field label="Yıllık Basit Oran" value={yillikOran} onChange={setYillikOran} suffix="%"/>
        <Field label="Taksit Sayısı" value={taksitSayisi} onChange={setTaksitSayisi} suffix="Ay"/>
      </Card>

      {r && (
        <Card>
          <SecTitle>Hesaplama Sonucu</SecTitle>
          <RRow label="Finansman Tutarı" value={fmtTL(r.T)}/>
          <RRow label="Vade" value={`${r.taksit} Ay (${r.gun} Gün)`}/>
          <RRow label="Yıllık Basit Oran" value={`%${fmtN(r.oran)}`}/>
          <RRow label="Sabit Aylık Taksit" value={fmtTL(r.sabitTaksit)} sub/>
          <RRow label="Firmadan Alınacak Katkı Payı (Tutar)" value={fmtTL(r.toplamKatkiPayi)} accent={C.orange} big/>
          <RRow label="Katkı Payı Oranı" value={`%${fmtN(r.katkiPayiOrani,2)}`} accent={C.orange} big/>

          <button onClick={()=>setShowPlan(true)} style={{width:"100%",marginTop:12,padding:"12px",borderRadius:12,border:`1.5px solid ${C.blue}`,background:C.blueLight,color:C.blue,fontWeight:700,fontSize:14,cursor:"pointer"}}>
            📅 Aylık Katkı Payı Dağılımını Görüntüle
          </button>

          <RaporButon baslik="Katkı Payı Hesaplama Analizi" plan={r.plan} satirlar={[
            {label:"Finansman Tutarı", value:fmtTL(r.T), big:true},
            {label:"Vade", value:`${r.taksit} ay (${r.gun} gün)`},
            {label:"Yıllık Basit Oran", value:`% ${fmtN(r.oran)}`},
            {label:"Sabit Aylık Taksit", value:fmtTL(r.sabitTaksit)},
            {label:"Firmadan Alınacak Katkı Payı (Tutar)", value:fmtTL(r.toplamKatkiPayi), big:true},
            {label:"Katkı Payı Oranı", value:`% ${fmtN(r.katkiPayiOrani,2)}`, big:true},
          ]}/>
        </Card>
      )}

      {showPlan&&r&&<OdemePlani
        plan={r.plan}
        bsmvOran={0}
        kkdfOran={0}
        onClose={()=>setShowPlan(false)}
        showKomisyon={false}
        basitOran={r.oran}
        efektifOran={r.katkiPayiOrani}
        anaparaTutar={r.T}
        taksitAraligiGun={30}/>}
    </div>
  );
}

// ─── FİNANSAL GÖSTERGELER ───────────────────────────────────────────────────
function FinansalGostergeler({onKurTikla}:any){
  const [kurlar,setKurlar]=useState(null);
  const [yukleniyor,setYukleniyor]=useState(true);
  const [sonGuncelleme,setSonGuncelleme]=useState(null);
  const [kripto,setKripto]=useState(null);
  const [petrol,setPetrol]=useState(null);
  const [piyasalar,setPiyasalar]=useState(null);
  const [fredVeriler,setFredVeriler]=useState<any>(null);
  const [evdsMakro,setEvdsMakro]=useState<any>(null);

  // Fallback: 24 Haz 2026 19:41 Investing.com
  const FALLBACK=[
    {ad:"USD/TRY",deger:"46,4302",canli:false},
    {ad:"EUR/TRY",deger:"52,7177",canli:false},
    {ad:"GBP/TRY",deger:"61,0739",canli:false},
    {ad:"Gümüş/TRY (Gram)",deger:"88,67",canli:false},
    {ad:"EUR/USD",deger:"1,1351",canli:false},
    {ad:"Altın/TRY (Gram)",deger:"5.994,00",canli:false},
  ];

  useEffect(()=>{
    const fmt=(n,dec)=>n!=null?n.toLocaleString('tr-TR',{minimumFractionDigits:dec,maximumFractionDigits:dec}):null;

    const fetchTimeout = (url, ms=4000) => {
      const controller = new AbortController();
      const timer = setTimeout(()=>controller.abort(), ms);
      return fetch(url, {signal: controller.signal})
        .then(r=>r.ok?r.json():null)
        .catch(()=>null)
        .finally(()=>clearTimeout(timer));
    };

    // 1) Kurları öncelikli ve hızlı çek (ana ekran bunu bekliyor)
    Promise.all([
      fetchKurlarViaClaudeAPI(),
      fetchTimeout('/api/altin', 4000),
    ]).then(([d, altin])=>{
      if(d){
        setKurlar([
          {ad:"USD/TRY",          deger:fmt(d.USD_TRY,4),           canli:true},
          {ad:"EUR/TRY",          deger:fmt(d.EUR_TRY,4),           canli:true},
          {ad:"Altın/TRY (Gram)", deger:fmt(altin?.XAU_TRY_gram,2), canli:altin?.XAU_TRY_gram!=null},
          {ad:"Gümüş/TRY (Gram)",deger:fmt(altin?.XAG_TRY_gram,2), canli:altin?.XAG_TRY_gram!=null},
          {ad:"EUR/USD",          deger:fmt(d.EUR_USD,4),            canli:true},
          {ad:"Ons Altın/USD",    deger:fmt(altin?.XAU_USD,2), canli:altin?.XAU_USD!=null},
        ]);
        setSonGuncelleme(new Date());
      } else {
        setKurlar(null);
      }
      setYukleniyor(false); // kurlar gelir gelmez ekranı göster, geri kalanı arka planda yükle
    }).catch(()=>{ setKurlar(null); setYukleniyor(false); });

    // 2) Geri kalan veriler (kripto, petrol, piyasalar, EVDS) arka planda, ekranı bloklamadan
    Promise.all([
      fetchTimeout('/api/kripto', 4000),
      fetchTimeout('/api/petrol', 4000),
      fetchTimeout('/api/piyasalar', 4000),
      fetchTimeout('/api/evds-proxy', 5000),
    ]).then(([kriptoData, petrolData, piyasalarData, evdsData])=>{
      if(kriptoData?.btc_usd) setKripto(kriptoData);
      if(petrolData?.brent_usd) setPetrol(petrolData);
      if(piyasalarData?.data) setPiyasalar(piyasalarData.data);
      if(evdsData?.seriler) setEvdsMakro(evdsData.seriler);
    });

    const interval = setInterval(()=>{
      fetchKurlarViaClaudeAPI().then(d=>{
        if(d) setSonGuncelleme(new Date());
      });
    }, 10*60*1000);
    return () => clearInterval(interval);
  },[]);

  const gosterKurlar=kurlar||FALLBACK;
  const canliVar=kurlar!==null;

  // Dinamik EVDS enflasyon verisi
  const fmtPct=(v:any,tarih:any)=>v!=null?{deger:`%${parseFloat(v).toFixed(2).replace(".",",")}`,tarih:tarih||""}:{deger:"—",tarih:""};
  const tufY  =fmtPct(evdsMakro?.["TUFE_YILLIK"]?.deger, evdsMakro?.["TUFE_YILLIK"]?.tarih);
  const tufA  =fmtPct(evdsMakro?.["TUFE_AYLIK"]?.deger, evdsMakro?.["TUFE_AYLIK"]?.tarih);
  const apifon=fmtPct(evdsMakro?.["TP.APIFON4"]?.deger, evdsMakro?.["TP.APIFON4"]?.tarih);
  const tltefk=evdsMakro?.["TP.BISTTLREF.KAPANIS"];
  // FRED verileri
  const sofr   =fredVeriler?.["SOFR"];
  const eur3m  =fredVeriler?.["EUR3MTD156N"];
  const eur6m  =fredVeriler?.["EUR6MTD156N"];
  const fmtFred=(v:any)=>v?.deger!=null?`%${v.deger.toFixed(2).replace(".",",")}`:null;
  const fmtFreT=(v:any)=>v?.tarih||"";

  const SABIT=[
    {kategori:"Faiz & Para Politikası",icon:"🏛️",color:"#5B9BD8",items:[
      {ad:"TCMB Politika Faizi (1 Hafta Repo)",deger:apifon.deger,tarih:apifon.tarih||"Haziran 2026",canli:evdsMakro?.["TP.APIFON4"]!=null},
      {ad:"TCMB Üst Bant (Borç Verme)",deger:"%40,00",tarih:"Haziran 2026"},
      {ad:"TCMB Alt Bant (Borçlanma)",deger:"%34,00",tarih:"Haziran 2026"},
      {ad:"TLTEFK (BIST-TLREF)",deger:tltefk?.deger!=null?`%${tltefk.deger.toFixed(2).replace(".",",")}`:"%—",tarih:tltefk?.tarih||"EVDS",canli:tltefk!=null},
    ]},
    {kategori:"Enflasyon",icon:"📊",color:"#F87171",items:[
      {ad:"TÜFE (Yıllık)",    deger:tufY.deger, tarih:tufY.tarih,  canli:evdsMakro?.TUFE_YILLIK!=null},
      {ad:"TÜFE (Aylık)",     deger:tufA.deger, tarih:tufA.tarih,  canli:evdsMakro?.TUFE_AYLIK!=null},
    ]},
    {kategori:"Referans Faizler",icon:"🌐",color:"#2A7A72",items:[
      {ad:"SOFR",             deger:fmtFred(sofr)||"—",  tarih:fmtFreT(sofr),  canli:sofr!=null},
      {ad:"EURIBOR 3M",       deger:fmtFred(eur3m)||"—", tarih:fmtFreT(eur3m), canli:eur3m!=null},
      {ad:"EURIBOR 6M",       deger:fmtFred(eur6m)||"—", tarih:fmtFreT(eur6m), canli:eur6m!=null},
    ]},
    {kategori:"CDS & Risk",icon:"⚡",color:"#9C3060",items:[
      {ad:"Türkiye 5Y CDS",deger:"~250 bps",tarih:"Haziran 2026"},
      {ad:"EMBI+ Türkiye",deger:"~280 bps",tarih:"Haziran 2026"},
    ]},
  ];



  const p=piyasalar;
  const PIYASA_GRUPLARI=[
    {
      baslik:"BORSA ENDEKSLERİ", icon:"📈", color:"#1A5C4A",
      items:[
        {ad:"BIST 100",     sembol:"XU100.IS", para:"₺", dec:0},
        {ad:"S&P 500",      sembol:"^GSPC",    para:"$", dec:2},
        {ad:"NASDAQ",       sembol:"^IXIC",    para:"$", dec:2},
        {ad:"Dow Jones",    sembol:"^DJI",     para:"$", dec:0},
        {ad:"DAX",          sembol:"^GDAXI",   para:"€", dec:2},
      ]
    },
    {
      baslik:"EMTİA", icon:"⚡", color:"#7A5000",
      items:[
        {ad:"Brent Petrol (USD)", sembol:"BZ=F",  para:"$", dec:2},
        {ad:"WTI Ham Petrol",     sembol:"CL=F",  para:"$", dec:2},
        {ad:"Doğalgaz (USD)",     sembol:"NG=F",  para:"$", dec:3},
        {ad:"Altın (Ons/USD)",    sembol:"GC=F",  para:"$", dec:2},
        {ad:"Gümüş (Ons/USD)",   sembol:"SI=F",  para:"$", dec:3},
        {ad:"Bakır (USD)",        sembol:"HG=F",  para:"$", dec:3},
        {ad:"Buğday (c/bu)",      sembol:"ZW=F",  para:"¢", dec:2},
      ]
    },
    {
      baslik:"KRİPTO PARA", icon:"₿", color:"#F7931A",
      items:[
        {ad:"Bitcoin (USD)",  sembol:"BTC-USD", para:"$", dec:0},
        {ad:"Ethereum (USD)", sembol:"ETH-USD", para:"$", dec:2},
      ]
    },
    {
      baslik:"TAHVİL & FAİZ", icon:"🏛️", color:"#5B9BD8",
      items:[
        {ad:"ABD 10Y Tahvil", sembol:"^TNX", para:"%", dec:3},
        {ad:"ABD 2Y Tahvil",  sembol:"^IRX", para:"%", dec:3},
      ]
    },
  ];

  return(
    <div style={{padding:"0 16px 32px"}}>
      {/* Döviz & Emtia Kurları */}
      <div style={{background:"linear-gradient(135deg,#1C3A5E 0%,#5B9BD8 100%)",borderRadius:16,padding:"16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{margin:0,fontSize:14,fontWeight:800,color:"#fff"}}>💱 Döviz & Emtia</p>
          <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.75)"}}>
            {yukleniyor?"⏳ Yükleniyor...":
             canliVar?`🟢 ${sonGuncelleme?.toLocaleTimeString('tr-TR')} canlı`:
             "🟡 Manuel — 24 Haz 19:41"}
          </p>
        </div>
        {yukleniyor?(
          <div style={{textAlign:"center",padding:"20px"}}>
            <p style={{margin:0,fontSize:22,letterSpacing:8,color:"rgba(255,255,255,0.4)"}}>· · ·</p>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {gosterKurlar.map((k,i)=>(
              <div key={i} onClick={()=>{
                  const sembolMap:any={"USD/TRY":"USDTRY=X","EUR/TRY":"EURTRY=X","GBP/TRY":"GBPTRY=X","Altın/TRY (Gram)":"GRAM_ALTIN","Gümüş/TRY (Gram)":"GRAM_GUMUS","Ons Altın/USD":"GC=F"};
                  const s=sembolMap[k.ad];
                  if(s) onKurTikla?.({kod:k.ad,sembol:s});
                }} style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 12px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.65)",fontWeight:600,flex:1}}>{k.ad}</p>
                  {k.not&&<span style={{fontSize:9,color:"rgba(255,200,0,0.8)",fontWeight:600,flexShrink:0}}>{k.not}</span>}
                </div>
                <p style={{margin:"4px 0 0",fontSize:17,fontWeight:800,color:k.canli?"#fff":"rgba(255,255,255,0.7)",fontFamily:"monospace"}}>{k.deger||"—"}</p>
              </div>
            ))}
          </div>
        )}
        {!yukleniyor&&!canliVar&&(
          <div style={{marginTop:10,background:"rgba(255,200,0,0.15)",borderRadius:8,padding:"7px 12px"}}>
            <p style={{margin:0,fontSize:11,color:"rgba(255,220,100,0.9)"}}>⚠️ Canlı kur alınamadı. Lütfen daha sonra tekrar deneyin.</p>
          </div>
        )}
      </div>

      <div style={{background:"rgba(91,155,216,0.15)",borderRadius:10,padding:"9px 12px",marginBottom:14,display:"flex",gap:8,alignItems:"flex-start",border:`1px solid ${C.blue}`}}>
        <span style={{fontSize:13}}>ℹ️</span>
        <p style={{margin:0,fontSize:11,color:C.blue,lineHeight:1.4}}>Altın ve gümüş fiyatları periyodik güncellenir. Anlık takip için TCMB ve Bloomberg'e başvurun.</p>
      </div>




      {PIYASA_GRUPLARI.map((grup,gi)=>(
        <div key={gi} style={{marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px 6px"}}>
            <span style={{fontSize:18}}>{grup.icon}</span>
            <span style={{fontSize:11,fontWeight:800,color:grup.color,letterSpacing:"0.08em"}}>{grup.baslik}</span>
            {piyasalar&&<span style={{fontSize:9,color:"#34C759",fontWeight:700,marginLeft:4}}>● CANLI</span>}
          </div>
          <div style={{background:C.card,borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
            {grup.items.map((item,ii)=>{
              const deger=p?.[item.sembol]?.fiyat;
              const deg=p?.[item.sembol]?.degisim;
              const pozitif=parseFloat(deg)>0;
              return(
                <div key={ii} onClick={()=>onKurTikla?.({kod:item.ad, ad:item.ad, sembol:item.sembol, emtia:true})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:ii<grup.items.length-1?"1px solid rgba(255,255,255,0.1)":"none",cursor:"pointer"}}>
                  <div>
                    <p style={{margin:0,fontSize:13,fontWeight:600,color:"#F1F5F9"}}>{item.ad}</p>
                    {deg&&<span style={{fontSize:10,fontWeight:700,color:pozitif?"#16A34A":"#DC2626"}}>{pozitif?"+":""}{deg}%</span>}
                  </div>
                  <span style={{fontSize:14,fontWeight:800,color:deger!=null?grup.color:"#9CA3AF",fontFamily:"monospace"}}>
                    {deger!=null?`${item.para}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:item.dec,maximumFractionDigits:item.dec}).format(deger)}`:"—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {SABIT.map((kat,ki)=>(
        <div key={ki} style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <span style={{fontSize:16}}>{kat.icon}</span>
            <p style={{fontSize:12,fontWeight:800,color:kat.color,textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>{kat.kategori}</p>
          </div>
          <div style={{background:C.card,borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
            {kat.items.map((item,ii)=>(
              <div key={ii} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderBottom:ii<kat.items.length-1?`1px solid ${C.border}`:"none"}}>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:13,fontWeight:700,color:C.label}}>{item.ad}</p>
                  <p style={{margin:"1px 0 0",fontSize:10,color:C.sub}}>{item.tarih}</p>
                </div>
                <span style={{fontSize:15,fontWeight:800,color:kat.color,fontFamily:"monospace",marginLeft:8}}>{item.deger}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


// ─── MENÜ TANIMLARI ──────────────────────────────────────────────────────────
const MENU = {
  home: null,
  // ── ALT BAR ANA SEKMELERİ ──
  hesaplaMenu:{title:"Hesaplama Araçları",back:"home"},
  piyasaMenu:{title:"Piyasa & Veriler",back:"home"},
  araclarMenu:{title:"Araçlar",back:"home"},
  toggFinansman:{title:"Togg Finansmanı Hesaplama",back:"hesaplaMenu"},
  arsaIsyeri:{title:"Arsa/İşyeri Finansmanı",back:"hesaplaMenu"},
  // katılım fonu
  vadeliKatilim:{title:"Katılım Hesabı Getiri Hesaplama",back:"hesaplaMenu"},
  getiridenAnapara:{title:"Getiriden Anapara Hesaplama",back:"hesaplaMenu"},
  oranAnalizi:{title:"Günlük Hesap Oran Hesaplama",back:"hesaplaMenu"},
  tahvilBono:{title:"Sukuk Kira Sertifikası Getiri Hesaplama",back:"hesaplaMenu"},
  kasaOranAnalizi:{title:"Kasa Hesabı Oran Analizi",back:"hesaplaMenu"},
  verimlilikAnalizi:{title:"Verimlilik Analizi",back:"hesaplaMenu"},
  fonGetiriIzleme:{title:"Yatırım Fonları Getiri İzleme",back:"home"},
  bistHisseTarayici:{title:"BİST Hisse Veri İzleme",back:"home"},
  // bireysel finansman (sadece 3)
  konutFinansman:{title:"Konut Finansmanı Hesaplama",back:"hesaplaMenu"},
  tasitFinansman:{title:"Taşıt Finansmanı Hesaplama",back:"hesaplaMenu"},
  yatirimFonuFinansman:{title:"Yatırım Fonu Finansmanı Hesaplama",back:"hesaplaMenu"},
  taksitenKredi:{title:"Taksitten Tutar Hesaplama",back:"hesaplaMenu"},
  // ticari finansman (spot + leasing + taksitli ticari)
  spotFinansman:{title:"Spot Finansman Hesaplama",back:"hesaplaMenu"},
  taksitliTicari:{title:"Taksitli Ticari Finansman Hesaplama",back:"hesaplaMenu"},
  leasing:{title:"Finansal Kiralama Hesaplama",back:"hesaplaMenu"},
  posHesaplama:{title:"POS Komisyon Hesaplama",back:"hesaplaMenu"},
  tmKomisyon:{title:"Teminat Mektubu Komisyon Hesaplama",back:"hesaplaMenu"},
  akreditifKomisyon:{title:"Akreditif Komisyon Hesaplama",back:"hesaplaMenu"},
  soikReeskont:{title:"SÖİK & Reeskont Finansmanı",back:"hesaplaMenu"},
  katkiPayi:{title:"Katkı Payı Hesaplama",back:"hesaplaMenu"},
  esnekOdemePlanlari:{title:"Esnek Ödeme Planları Hesaplama",back:"hesaplaMenu"},
  esitAnapara:{title:"Eşit Anapara Ödeme Planı",back:"esnekOdemePlanlari"},
  araOdemeli:{title:"Ara Ödemeli Plan",back:"esnekOdemePlanlari"},
  artanOdemeli:{title:"Artan Ödemeli Plan",back:"esnekOdemePlanlari"},
  azalanOdemeli:{title:"Azalan Ödemeli Plan",back:"esnekOdemePlanlari"},
  balonOdemeli:{title:"Balon Ödemeli Plan",back:"esnekOdemePlanlari"},
  esnekOdemeli:{title:"Esnek Ödemeli Plan",back:"esnekOdemePlanlari"},
  // diğer
  asistan:{title:"Yapay Zeka Asistan",back:"araclarMenu"},
  sozluk:{title:"Katılım Bankacılığı Sözlüğü",back:"araclarMenu"},
  gecmis:{title:"Son Hesaplamalar",back:"home"},
  finansalTakvim:{title:"Finansal Takvim",back:"home"},
  vadeTakibi:{title:"Vade Takip & Hatırlatma Ajandam",back:"araclarMenu"},
  hazineDoviz:{title:"Döviz Dönüştürücü",back:"hesaplaMenu"},
  hazineForward:{title:"Forward Hesaplama",back:"hesaplaMenu"},
  hazineSwap:{title:"Swap Hesaplama",back:"hesaplaMenu"},
  hazineBono:{title:"Hazine Bonosu Getiri",back:"hesaplaMenu"},
  hazineSenaryo:{title:"Kur Hareketi Senaryo",back:"hesaplaMenu"},
  piyasaHaberleri:{title:"Piyasa Haberleri",back:"home"},
  finansalGostergeler:{title:"Finansal Göstergeler",back:"piyasaMenu"},
  ayarlar:{title:"Ayarlar",back:"home"},
  profil:{title:"Profil",back:"home"},
};

// Ekranı alt bar sekmesine eşler (vurgulama için)
const TAB_OF_SCREEN:any = {
  home:"home", finansalTakvim:"home",
  hesaplaMenu:"hesapla",
  toggFinansman:"hesapla", arsaIsyeri:"hesapla",
  vadeliKatilim:"hesapla", getiridenAnapara:"hesapla", oranAnalizi:"hesapla", tahvilBono:"hesapla",
  kasaOranAnalizi:"hesapla", verimlilikAnalizi:"hesapla",
  konutFinansman:"hesapla", tasitFinansman:"hesapla", yatirimFonuFinansman:"hesapla", taksitenKredi:"hesapla",
  spotFinansman:"hesapla", taksitliTicari:"hesapla", leasing:"hesapla", posHesaplama:"hesapla",
  tmKomisyon:"hesapla", akreditifKomisyon:"hesapla", soikReeskont:"hesapla", katkiPayi:"hesapla",
  esnekOdemePlanlari:"hesapla", esitAnapara:"hesapla", araOdemeli:"hesapla", artanOdemeli:"hesapla",
  azalanOdemeli:"hesapla", balonOdemeli:"hesapla", esnekOdemeli:"hesapla",
  piyasaMenu:"piyasa", fonGetiriIzleme:"piyasa", bistHisseTarayici:"piyasa",
  hazineDoviz:"hesapla", hazineForward:"hesapla", hazineSwap:"hesapla",
  hazineBono:"hesapla", hazineSenaryo:"hesapla",
  piyasaHaberleri:"piyasa", finansalGostergeler:"piyasa",
  araclarMenu:"araclar", sozluk:"araclar", vadeTakibi:"araclar",
  asistan:"yapayzeka",
  profil:"profil",
};

const ALT_BAR_SEKMELERI = [
  {tab:"home",      key:"home",        tip:"home",      label:"Ana Sayfa"},
  {tab:"hesapla",   key:"hesaplaMenu", tip:"hesapla",   label:"Hesapla"},
  {tab:"piyasa",    key:"piyasaMenu",  tip:"piyasa",    label:"Piyasa"},
  {tab:"araclar",   key:"araclarMenu", tip:"araclar",   label:"Araçlar"},
  {tab:"yapayzeka", key:"asistan",     tip:"yapayzeka", label:"Asistan"},
  {tab:"profil",    key:"profil",      tip:"profil",    label:"Profil"},
];

// Alt bar için düz (line) SVG ikonlar
function AltBarIcon({tip,aktif}:{tip:string,aktif:boolean}){
  const renk = aktif ? "#5B9BD8" : "rgba(255,255,255,0.45)";
  const sw = aktif ? 2.2 : 1.8;
  const common:any = {width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:renk,strokeWidth:sw,strokeLinecap:"round",strokeLinejoin:"round"};
  if(tip==="home") return (
    <svg {...common}>
      <path d="M3 11.5 12 4l9 7.5"/>
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9.5v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20h3a1 1 0 0 0 1-1v-9"/>
    </svg>
  );
  if(tip==="hesapla") return (
    <svg {...common}>
      <rect x="5" y="3" width="14" height="18" rx="2.5"/>
      <rect x="7.5" y="5.5" width="9" height="3.8" rx="0.8" fill={renk} stroke="none" opacity={0.18}/>
      <line x1="8.3" y1="13" x2="8.3" y2="13" strokeWidth={sw+1.1}/>
      <line x1="12" y1="13" x2="12" y2="13" strokeWidth={sw+1.1}/>
      <line x1="15.7" y1="13" x2="15.7" y2="13" strokeWidth={sw+1.1}/>
      <line x1="8.3" y1="16.6" x2="8.3" y2="16.6" strokeWidth={sw+1.1}/>
      <line x1="12" y1="16.6" x2="12" y2="16.6" strokeWidth={sw+1.1}/>
      <line x1="15.7" y1="16.6" x2="15.7" y2="16.6" strokeWidth={sw+1.1}/>
    </svg>
  );
  if(tip==="piyasa") return (
    <svg {...common}>
      <path d="M3 16.5 9 10l4 4 8-9"/>
      <path d="M15 5h6v6"/>
    </svg>
  );
  if(tip==="araclar") return (
    <svg {...common}>      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
  if(tip==="yapayzeka") return (
    <svg {...common}>
      <rect x="4.5" y="9" width="15" height="10.5" rx="3"/>
      <path d="M12 9V6"/>
      <circle cx="12" cy="4.3" r="1.3" fill={renk} stroke="none"/>
      <circle cx="9" cy="14.2" r="1.3" fill={renk} stroke="none"/>
      <circle cx="15" cy="14.2" r="1.3" fill={renk} stroke="none"/>
      <path d="M2.5 13v3"/>
      <path d="M21.5 13v3"/>
    </svg>
  );
  if(tip==="profil") return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.6"/>
      <path d="M4.5 19.2c0-3.7 3.3-6.4 7.5-6.4s7.5 2.7 7.5 6.4"/>
    </svg>
  );
  return null;
}

// Menü arama listesi — tüm ekranlar
const MENU_ARAMA_LIST=[
  {key:"vadeliKatilim",      label:"Katılım Hesabı Getiri Hesaplama",     icon:"💰", grup:"Katılım Fonu"},
  {key:"getiridenAnapara",   label:"Getiriden Anapara Hesaplama",          icon:"🔄", grup:"Katılım Fonu"},
  {key:"oranAnalizi",        label:"Günlük Hesap Oran Hesaplama",          icon:"📐", grup:"Katılım Fonu"},
  {key:"tahvilBono",         label:"Sukuk Kira Sertifikası Getiri",        icon:"📜", grup:"Katılım Fonu"},
  {key:"kasaOranAnalizi",    label:"Kasa Hesabı Oran Analizi",             icon:"🏛️", grup:"Katılım Fonu"},
  {key:"verimlilikAnalizi",  label:"Verimlilik Analizi",                   icon:"📊", grup:"Katılım Fonu"},
  {key:"konutFinansman",     label:"Konut Finansmanı Hesaplama",           icon:"🏠", grup:"Bireysel Finansman"},
  {key:"tasitFinansman",     label:"Taşıt Finansmanı Hesaplama",           icon:"🚗", grup:"Bireysel Finansman"},
  {key:"yatirimFonuFinansman",label:"Yatırım Fonu Finansmanı Hesaplama",  icon:"📈", grup:"Bireysel Finansman"},
  {key:"toggFinansman",      label:"Togg Finansmanı Hesaplama",            icon:"⚡", grup:"Bireysel Finansman"},
  {key:"esnekOdemePlanlari", label:"Esnek Ödeme Planları Hesaplama",       icon:"📋", grup:"Bireysel Finansman"},
  {key:"spotFinansman",      label:"Spot Finansman Hesaplama",             icon:"⚡", grup:"Tüzel Finansman"},
  {key:"taksitliTicari",     label:"Taksitli Ticari Finansman Hesaplama",  icon:"🏗️", grup:"Tüzel Finansman"},
  {key:"leasing",            label:"Finansal Kiralama Hesaplama",          icon:"🔑", grup:"Tüzel Finansman"},
  {key:"posHesaplama",       label:"POS Komisyon Hesaplama",               icon:"💳", grup:"Tüzel Finansman"},
  {key:"tmKomisyon",         label:"Teminat Mektubu Komisyon Hesaplama",                icon:"📄", grup:"Tüzel Finansman"},
  {key:"akreditifKomisyon",  label:"Akreditif Komisyon Hesaplama",         icon:"🌐", grup:"Tüzel Finansman"},
  {key:"soikReeskont",       label:"SÖİK & Reeskont Finansmanı",            icon:"🚢", grup:"Tüzel Finansman"},
  {key:"bistHisseTarayici",  label:"BİST Hisse Veri İzleme",                     icon:"📊", grup:"Piyasa & Veriler"},
  {key:"fonGetiriIzleme",    label:"Yatırım Fonları Getiri İzleme",        icon:"📈", grup:"Piyasa & Veriler"},
  {key:"finansalGostergeler",label:"Finansal Göstergeler",                 icon:"📉", grup:"Piyasa & Veriler"},
  {key:"finansalTakvim",     label:"Finansal Takvim",                      icon:"📅", grup:"Araçlar"},
  {key:"vadeTakibi",         label:"Vade Takip & Hatırlatma Ajandam",             icon:"⏰", grup:"Araçlar"},
  {key:"hazineDoviz",        label:"Döviz Dönüştürücü",                          icon:"💱", grup:"Hesaplama Araçları"},
  {key:"hazineForward",      label:"Forward Hesaplama",                          icon:"📅", grup:"Hesaplama Araçları"},
  {key:"hazineSwap",         label:"Swap Hesaplama",                             icon:"🔄", grup:"Hesaplama Araçları"},
  {key:"hazineBono",         label:"Hazine Bonosu Getiri",                       icon:"📜", grup:"Hesaplama Araçları"},
  {key:"hazineSenaryo",      label:"Kur Hareketi Senaryo",                       icon:"📊", grup:"Hesaplama Araçları"},
  {key:"piyasaHaberleri",    label:"Piyasa Haberleri",                            icon:"📡", grup:"Piyasa & Veriler"},
  {key:"asistan",            label:"Yapay Zeka Asistan",                   icon:"🤖", grup:"Araçlar"},
  {key:"sozluk",             label:"Katılım Bankacılığı Sözlüğü",          icon:"📖", grup:"Araçlar"},
  {key:"ayarlar",            label:"Ayarlar",                              icon:"⚙️", grup:"Araçlar"},
  {key:"profil",             label:"Profil",                               icon:"👤", grup:"Araçlar"},
];

// ── HESAPLA SEKMESİ: kategoriler ve düz araç listesi (arama + filtre) ──
const HESAPLA_KATEGORILER = [
  {id:"tumu",     label:"Tümü"},
  {id:"katilim",  label:"Katılım Fonu"},
  {id:"bireysel", label:"Bireysel Finansman"},
  {id:"ticari",   label:"Tüzel Finansman"},
  {id:"hazine",   label:"Hazine İşlemleri"},
  {id:"gecmis",   label:"Son Hesaplamalar", baslik:"Son Hesaplamalar"},
];

const HESAPLA_ARAC_LISTESI = [
  // Katılım Fonu
  {key:"vadeliKatilim",      icon:"💰", label:"Katılım Hesabı Getiri Hesaplama",      kat:"katilim"},
  {key:"getiridenAnapara",   icon:"🎯", label:"Getiriden Anapara Hesaplama",          kat:"katilim"},
  {key:"oranAnalizi",        icon:"📐", label:"Günlük Hesap Oran Hesaplama",          kat:"katilim"},
  {key:"tahvilBono",         icon:"📜", label:"Sukuk Kira Sertifikası Getiri Hesaplama", kat:"katilim"},
  {key:"kasaOranAnalizi",    icon:"🔄", label:"Kasa Hesabı Oran Analizi",             kat:"katilim"},
  {key:"verimlilikAnalizi",  icon:"📊", label:"Verimlilik Analizi",                   kat:"katilim"},
  // Bireysel Finansman
  {key:"konutFinansman",     icon:"🏠", label:"Konut Finansmanı Hesaplama",           kat:"bireysel"},
  {key:"tasitFinansman",     icon:"🚗", label:"Taşıt Finansmanı Hesaplama",           kat:"bireysel"},
  {key:"yatirimFonuFinansman",icon:"📦", label:"Yatırım Fonu Finansmanı Hesaplama",   kat:"bireysel"},
  {key:"toggFinansman",      icon:"⚡", label:"Togg Finansmanı Hesaplama",            kat:"bireysel"},
  {key:"arsaIsyeri",         icon:"🏢", label:"Arsa/İşyeri Finansmanı Hesaplama",     kat:"bireysel"},
  {key:"taksitenKredi",      icon:"🔢", label:"Taksitten Tutar Hesaplama",            kat:"bireysel"},
  // Tüzel Finansman
  {key:"spotFinansman",      icon:"⚡", label:"Spot Finansman Hesaplama",             kat:"ticari"},
  {key:"taksitliTicari",     icon:"🏗️", label:"Taksitli Ticari Finansman Hesaplama",  kat:"ticari"},
  {key:"esnekOdemePlanlari", icon:"📋", label:"Esnek Ödeme Planları Hesaplama",       kat:"ticari"},
  {key:"leasing",            icon:"🚙", label:"Finansal Kiralama Hesaplama",          kat:"ticari"},
  {key:"posHesaplama",       icon:"💳", label:"POS Komisyon Hesaplama",               kat:"ticari"},
  {key:"tmKomisyon",         icon:"📄", label:"Teminat Mektubu Komisyon Hesaplama",                kat:"ticari"},
  {key:"akreditifKomisyon",  icon:"🌐", label:"Akreditif Komisyon Hesaplama",         kat:"ticari"},
  {key:"soikReeskont",       icon:"🚢", label:"SÖİK & Reeskont Finansmanı",           kat:"ticari"},
  {key:"katkiPayi",          icon:"🎁", label:"Katkı Payı Hesaplama",                 kat:"ticari"},
  // Hazine İşlemleri
  // Hazine İşlemleri
  {key:"hazineDoviz",        icon:"💱", label:"Döviz Dönüştürücü",                   kat:"hazine"},
  {key:"hazineForward",      icon:"📅", label:"Forward Hesaplama",                   kat:"hazine"},
  {key:"hazineSwap",         icon:"🔄", label:"Swap Hesaplama",                      kat:"hazine"},
  {key:"hazineBono",         icon:"📜", label:"Hazine Bonosu Getiri Hesaplama",      kat:"hazine"},
  {key:"hazineSenaryo",      icon:"📊", label:"Kur Hareketi Senaryo Analizi",        kat:"hazine"},
  // Son Hesaplamalar
  {key:"gecmis",             icon:"🕐", label:"Son Hesaplamalar",                    kat:"gecmis"},
];

// ─── HAZİNE İŞLEMLERİ ─────────────────────────────────────────────────────────
const HT_PARA_BIRIMLERI = ["TRY","USD","EUR","GBP","CHF","SAR","AED","RUB","CNY","JPY","XAU","XAG"];
const HT_PARA_ETIKET:any = {TRY:"TRY",USD:"USD",EUR:"EUR",GBP:"GBP",CHF:"CHF",SAR:"SAR",AED:"AED",RUB:"RUB",CNY:"CNY",JPY:"JPY",XAU:"Altın (gr)",XAG:"Gümüş (gr)"};

function HtField({label,value,onChange,suffix,placeholder}:any){
  const formatGoster=(raw:string)=>{
    if(!raw) return "";
    const temiz=String(raw).replace(/\./g,"").replace(/[^0-9,]/g,"");
    const [tam,ondalik]=temiz.split(",");
    const tamFormatli=tam?tam.replace(/\B(?=(\d{3})+(?!\d))/g,"."):"";
    return ondalik!==undefined?`${tamFormatli},${ondalik}`:tamFormatli;
  };
  const handleChange=(v:string)=>{
    const temiz=v.replace(/\./g,"").replace(/[^0-9,]/g,"");
    onChange(temiz);
  };
  return(
    <div style={{marginBottom:10}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:C.sub,marginBottom:5}}>{label}</label>
      <div style={{position:"relative"}}>
        <input value={formatGoster(value)} onChange={e=>handleChange(e.target.value)} placeholder={placeholder}
          inputMode="decimal"
          style={{width:"100%",boxSizing:"border-box",padding:"12px 40px 12px 14px",fontSize:15,fontWeight:600,borderRadius:10,border:`1.5px solid ${C.border}`,background:C.card,outline:"none"}}/>
        {suffix&&<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:C.blue,fontWeight:700,fontSize:13}}>{suffix}</span>}
      </div>
    </div>
  );
}

function HtRRow({label,value,big,accent}:any){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
      <span style={{fontSize:big?13:12,color:C.sub,fontWeight:big?600:400}}>{label}</span>
      <span style={{fontSize:big?17:14,fontWeight:big?800:600,color:accent||C.label,fontFamily:"monospace"}}>{value}</span>
    </div>
  );
}

function HtParaSecici({value,onChange,haric}:any){
  return(
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.card,fontSize:14,fontWeight:700,color:C.blue,outline:"none",width:"100%"}}>
      {HT_PARA_BIRIMLERI.filter((p:string)=>p!==haric).map((p:string)=><option key={p} value={p}>{HT_PARA_ETIKET[p]||p}</option>)}
    </select>
  );
}

const htFmt2=(n:any)=>isNaN(n)||n===null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:4,maximumFractionDigits:4}).format(n);
const htFmtTL=(n:any,sembol="₺")=>isNaN(n)||n===null?"—":`${sembol}${new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)}`;

// 1. DÖVİZ DÖNÜŞTÜRÜCÜ - canlı kur verisiyle
function HtDovizDonusturucu(){
  const [tutar,setTutar]=useState("1000");
  const [kaynak,setKaynak]=useState("USD");
  const [hedef,setHedef]=useState("TRY");
  const [kurlar,setKurlar]=useState<any>(null);
  const [yukleniyor,setYukleniyor]=useState(true);

  useEffect(()=>{
    fetch("/api/kur").then(r=>r.ok?r.json():null).then(d=>{
      if(d){
        setKurlar({
          USD: d.USD_TRY, EUR: d.EUR_TRY, GBP: d.GBP_TRY, CHF: d.CHF_TRY,
          SAR: d.SAR_TRY, AED: d.AED_TRY, RUB: d.RUB_TRY, CNY: d.CNY_TRY, JPY: d.JPY_TRY,
          XAU: d.XAU_TRY_gram, XAG: d.XAG_TRY_gram, TRY: 1,
        });
      }
      setYukleniyor(false);
    }).catch(()=>setYukleniyor(false));
  },[]);

  const sonuc=useMemo(()=>{
    if(!kurlar) return null;
    const T=parseFloat(tutar.replace(",","."));
    if(!T) return null;
    if(!kurlar[kaynak] || !kurlar[hedef]) return {hata:true};
    const tryDegeri=T*kurlar[kaynak];
    const hedefDegeri=tryDegeri/kurlar[hedef];
    const capraKur=kurlar[kaynak]/kurlar[hedef];
    return {hedefDegeri,capraKur,tryDegeri};
  },[tutar,kaynak,hedef,kurlar]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <SecTitle>Döviz Dönüştürücü</SecTitle>
        <HtField label="Tutar" value={tutar} onChange={setTutar} placeholder="1000"/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
          <div style={{flex:1}}>
            <label style={{display:"block",fontSize:11,color:C.sub,marginBottom:4}}>Kaynak</label>
            <HtParaSecici value={kaynak} onChange={(v:string)=>{setKaynak(v); if(v===hedef) setHedef(HT_PARA_BIRIMLERI.find(p=>p!==v)!);}}/>
          </div>
          <button onClick={()=>{const t=kaynak;setKaynak(hedef);setHedef(t);}}
            style={{marginTop:18,padding:"10px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.blueLight,cursor:"pointer",fontSize:16}}>⇄</button>
          <div style={{flex:1}}>
            <label style={{display:"block",fontSize:11,color:C.sub,marginBottom:4}}>Hedef</label>
            <HtParaSecici value={hedef} onChange={setHedef} haric={kaynak}/>
          </div>
        </div>
      </Card>

      {yukleniyor && <div style={{textAlign:"center",padding:20,color:C.sub,fontSize:13}}>⏳ Kurlar yükleniyor...</div>}
      {!yukleniyor && !kurlar && <div style={{textAlign:"center",padding:20,color:C.red,fontSize:13}}>⚠️ Kur verisi alınamadı</div>}

      {sonuc && (sonuc as any).hata && (
        <Card>
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <p style={{margin:0,fontSize:13,color:C.red}}>⚠️ {HT_PARA_ETIKET[kaynak]} veya {HT_PARA_ETIKET[hedef]} için kur verisi şu an mevcut değil</p>
          </div>
        </Card>
      )}

      {sonuc && !(sonuc as any).hata && (
        <Card>
          <SecTitle>Sonuç</SecTitle>
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <p style={{margin:0,fontSize:13,color:C.sub}}>{tutar} {HT_PARA_ETIKET[kaynak]} =</p>
            <p style={{margin:"6px 0 0",fontSize:30,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>
              {htFmt2(sonuc.hedefDegeri).replace(/,0000$/,"")} {HT_PARA_ETIKET[hedef]}
            </p>
          </div>
          <HtRRow label={`1 ${HT_PARA_ETIKET[kaynak]} =`} value={`${htFmt2(sonuc.capraKur)} ${HT_PARA_ETIKET[hedef]}`}/>
          <HtRRow label={`1 ${HT_PARA_ETIKET[hedef]} =`} value={`${htFmt2(sonuc.capraKur?1/sonuc.capraKur:0)} ${HT_PARA_ETIKET[kaynak]}`}/>
        </Card>
      )}

      <div style={{background:C.greenLight,borderRadius:10,padding:"10px 14px"}}>
        <p style={{margin:0,fontSize:11,color:C.green,lineHeight:1.5}}>
          ✅ Kurlar canlı veri kaynağından (TCMB/piyasa) anlık çekilmektedir.
        </p>
      </div>
    </div>
  );
}

// 2. FORWARD HESAPLAMA - canlı kur + faiz verisiyle
function HtForwardHesaplama(){
  const [dovizCifti,setDovizCifti]=useState("USDTRY");
  const [tutar,setTutar]=useState("100000");
  const [spotKur,setSpotKur]=useState("");
  const [gun,setGun]=useState("180");
  const [bazFaiz,setBazFaiz]=useState("");
  const [karsiFaiz,setKarsiFaiz]=useState("");
  const [yukleniyor,setYukleniyor]=useState(true);

  const bazPara=dovizCifti.slice(0,3);
  const karsiPara=dovizCifti.slice(3);

  const [hataDetay,setHataDetay]=useState<string[]>([]);

  useEffect(()=>{
    setYukleniyor(true);
    Promise.all([
      fetch("/api/kur").then(r=>r.ok?r.json():null).catch(()=>null),
      fetch("/api/evds-proxy").then(r=>r.ok?r.json():null).catch(()=>null),
    ]).then(([kurD,evdsD])=>{
      const sorunlar:string[]=[];
      const kur = bazPara==="USD"?kurD?.USD_TRY:kurD?.EUR_TRY;
      if(kur) setSpotKur(String(kur).replace(".",",")); else sorunlar.push("Spot kur alınamadı (/api/kur)");
      const tryFaiz = evdsD?.seriler?.["TP.APIFON4"]?.deger;
      if(tryFaiz) setKarsiFaiz(String(tryFaiz).replace(".",",")); else sorunlar.push("TRY faizi alınamadı (/api/evds-proxy)");
      setHataDetay(sorunlar);
      setYukleniyor(false);
    }).catch((e)=>{setHataDetay([`Genel hata: ${e.message}`]);setYukleniyor(false);});
  },[dovizCifti]);

  const r=useMemo(()=>{
    const T=parseFloat(tutar.replace(",","."));
    const S=parseFloat(spotKur.replace(",","."));
    const G=parseInt(gun);
    const rBaz=parseFloat(bazFaiz.replace(",","."))/100;
    const rKarsi=parseFloat(karsiFaiz.replace(",","."))/100;
    if(!T||!S||!G||isNaN(rBaz)||isNaN(rKarsi)) return null;

    const forwardKur=S*(1+rKarsi*G/360)/(1+rBaz*G/360);
    const swapPuani=forwardKur-S;
    const forwardTutar=T*forwardKur;
    const spotTutar=T*S;
    const fark=forwardTutar-spotTutar;
    const primIskonto=swapPuani>=0?"Prim (Forward > Spot)":"İskonto (Forward < Spot)";

    return {forwardKur,swapPuani,forwardTutar,spotTutar,fark,primIskonto,T,S,G};
  },[tutar,spotKur,gun,bazFaiz,karsiFaiz]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <SecTitle>Döviz Çifti</SecTitle>
        <div style={{display:"flex",gap:6}}>
          {([["USDTRY","USD/TRY"],["EURTRY","EUR/TRY"]] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setDovizCifti(v)} style={{
              flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${dovizCifti===v?C.blue:C.border}`,
              background:dovizCifti===v?C.blueLight:C.card,color:dovizCifti===v?C.blue:C.sub,
              fontWeight:dovizCifti===v?700:500,fontSize:12,cursor:"pointer"
            }}>{l}</button>
          ))}
        </div>
      </Card>

      <Card>
        <SecTitle>İşlem Bilgileri {yukleniyor&&"⏳"}</SecTitle>
        <HtField label={`İşlem Tutarı (${bazPara})`} value={tutar} onChange={setTutar} suffix={bazPara}/>
        <HtField label="Spot Kur (Canlı veya elle girin)" value={spotKur} onChange={setSpotKur} suffix={karsiPara}/>
        <HtField label="Vade (Gün)" value={gun} onChange={setGun} suffix="Gün"/>
        <HtField label={bazPara==="USD"?"SOFR girin (örn. 4,50)":"EURIBOR girin (örn. 2,50)"} value={bazFaiz} onChange={setBazFaiz} suffix="%"/>
        <HtField label={`${karsiPara} Faiz Oranı — TCMB (Canlı veya elle girin)`} value={karsiFaiz} onChange={setKarsiFaiz} suffix="%"/>
        {!yukleniyor && hataDetay.length>0 ? (
          <div style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"8px 10px",marginTop:4}}>
            <p style={{margin:"0 0 3px",fontSize:11,fontWeight:700,color:C.red}}>⚠️ Bazı veriler otomatik çekilemedi:</p>
            {hataDetay.map((h,i)=><p key={i} style={{margin:0,fontSize:10,color:C.red}}>• {h}</p>)}
            <p style={{margin:"4px 0 0",fontSize:10,color:C.sub}}>Yukarıdaki alanları elle doldurarak hesaplamaya devam edebilirsiniz.</p>
          </div>
        ) : (
          <p style={{margin:"4px 0 0",fontSize:10,color:C.sub}}>📡 Değerler canlı kaynaklardan otomatik dolduruldu, gerekirse elle düzenleyebilirsiniz.</p>
        )}
      </Card>

      {r && (
        <Card>
          <SecTitle>Forward Hesaplama Sonucu</SecTitle>
          <div style={{textAlign:"center",padding:"12px 0",background:C.blueLight,borderRadius:10,marginBottom:10}}>
            <p style={{margin:0,fontSize:12,color:C.sub}}>Forward Kur</p>
            <p style={{margin:"4px 0 0",fontSize:28,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>{htFmt2(r.forwardKur)}</p>
          </div>
          <HtRRow label="Spot Kur" value={htFmt2(r.S)}/>
          <HtRRow label="Swap Puanı (Forward - Spot)" value={htFmt2(r.swapPuani)} accent={r.swapPuani>=0?C.green:C.red}/>
          <HtRRow label="Durum" value={r.primIskonto} accent={r.swapPuani>=0?C.green:C.red}/>
          <HtRRow label={`Spot Değer (${karsiPara})`} value={htFmtTL(r.spotTutar,"")}/>
          <HtRRow label={`Forward Değer (${karsiPara})`} value={htFmtTL(r.forwardTutar,"")} accent={C.blue} big/>
          <HtRRow label="Kur Farkı (Vade Sonu)" value={htFmtTL(r.fark,"")} accent={r.fark>=0?C.green:C.red}/>
        </Card>
      )}

      <div style={{background:C.orangeLight,borderRadius:10,padding:"10px 14px"}}>
        <p style={{margin:0,fontSize:11,color:C.orange,lineHeight:1.5}}>
          📐 Formül: F = S × (1 + r_TRY×gün/360) / (1 + r_döviz×gün/360)
        </p>
      </div>
    </div>
  );
}

// 3. SWAP HESAPLAMA - canlı kur + faiz verisiyle
function HtSwapHesaplama(){
  const [dovizCifti,setDovizCifti]=useState("USDTRY");
  const [tutar,setTutar]=useState("1000000");
  const [spotKur,setSpotKur]=useState("");
  const [gun,setGun]=useState("90");
  const [bazFaiz,setBazFaiz]=useState("");
  const [karsiFaiz,setKarsiFaiz]=useState("");
  const [yon,setYon]=useState("al-sat");
  const [yukleniyor,setYukleniyor]=useState(true);

  const bazPara=dovizCifti.slice(0,3);
  const karsiPara=dovizCifti.slice(3);

  useEffect(()=>{
    setYukleniyor(true);
    Promise.all([
      fetch("/api/kur").then(r=>r.ok?r.json():null).catch(()=>null),
      fetch("/api/evds-proxy").then(r=>r.ok?r.json():null).catch(()=>null),
    ]).then(([kurD,evdsD])=>{
      const kur = bazPara==="USD"?kurD?.USD_TRY:kurD?.EUR_TRY;
      if(kur) setSpotKur(String(kur).replace(".",","));
      const tryFaiz = evdsD?.seriler?.["TP.APIFON4"]?.deger;
      if(tryFaiz) setKarsiFaiz(String(tryFaiz).replace(".",","));
      setYukleniyor(false);
    }).catch(()=>setYukleniyor(false));
  },[dovizCifti]);

  const r=useMemo(()=>{
    const T=parseFloat(tutar.replace(",","."));
    const S=parseFloat(spotKur.replace(",","."));
    const G=parseInt(gun);
    const rBaz=parseFloat(bazFaiz.replace(",","."))/100;
    const rKarsi=parseFloat(karsiFaiz.replace(",","."))/100;
    if(!T||!S||!G||isNaN(rBaz)||isNaN(rKarsi)) return null;

    const forwardKur=S*(1+rKarsi*G/360)/(1+rBaz*G/360);
    const swapPuani=forwardKur-S;
    const swapPuaniYuzde=(swapPuani/S)*100;
    const swapTutari=T*swapPuani;
    const yillikGetiri=((forwardKur/S-1)*(360/G))*100;

    return {forwardKur,swapPuani,swapPuaniYuzde,swapTutari,yillikGetiri,S,T,G};
  },[tutar,spotKur,gun,bazFaiz,karsiFaiz]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <SecTitle>Döviz Çifti</SecTitle>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {([["USDTRY","USD/TRY"],["EURTRY","EUR/TRY"]] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setDovizCifti(v)} style={{
              flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${dovizCifti===v?C.blue:C.border}`,
              background:dovizCifti===v?C.blueLight:C.card,color:dovizCifti===v?C.blue:C.sub,
              fontWeight:dovizCifti===v?700:500,fontSize:12,cursor:"pointer"
            }}>{l}</button>
          ))}
        </div>
        <SecTitle>İşlem Yönü</SecTitle>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setYon("al-sat")} style={{
            flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${yon==="al-sat"?C.green:C.border}`,
            background:yon==="al-sat"?C.greenLight:"#fff",color:yon==="al-sat"?C.green:C.sub,
            fontWeight:yon==="al-sat"?700:500,fontSize:12,cursor:"pointer"
          }}>Spot Al / Forward Sat</button>
          <button onClick={()=>setYon("sat-al")} style={{
            flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${yon==="sat-al"?C.red:C.border}`,
            background:yon==="sat-al"?"rgba(248,113,113,0.12)":"#fff",color:yon==="sat-al"?C.red:C.sub,
            fontWeight:yon==="sat-al"?700:500,fontSize:12,cursor:"pointer"
          }}>Spot Sat / Forward Al</button>
        </div>
      </Card>

      <Card>
        <SecTitle>İşlem Bilgileri {yukleniyor&&"⏳"}</SecTitle>
        <HtField label={`Pozisyon Büyüklüğü (${bazPara})`} value={tutar} onChange={setTutar} suffix={bazPara}/>
        <HtField label="Spot Kur (Canlı)" value={spotKur} onChange={setSpotKur} suffix={karsiPara}/>
        <HtField label="Vade (Gün)" value={gun} onChange={setGun} suffix="Gün"/>
        <HtField label={bazPara==="USD"?"SOFR girin (örn. 4,50)":"EURIBOR girin (örn. 2,50)"} value={bazFaiz} onChange={setBazFaiz} suffix="%"/>
        <HtField label={`${karsiPara} Faiz Oranı — TCMB (Canlı)`} value={karsiFaiz} onChange={setKarsiFaiz} suffix="%"/>
      </Card>

      {r && (
        <Card>
          <SecTitle>Swap Hesaplama Sonucu</SecTitle>
          <div style={{textAlign:"center",padding:"12px 0",background:r.swapTutari>=0?C.greenLight:"rgba(248,113,113,0.12)",borderRadius:10,marginBottom:10}}>
            <p style={{margin:0,fontSize:12,color:C.sub}}>{r.swapTutari>=0?"Swap Geliri":"Swap Maliyeti"}</p>
            <p style={{margin:"4px 0 0",fontSize:26,fontWeight:900,color:r.swapTutari>=0?C.green:C.red,fontFamily:"monospace"}}>
              {htFmtTL(Math.abs(r.swapTutari),"")} {karsiPara}
            </p>
          </div>
          <HtRRow label="Spot Kur" value={htFmt2(r.S)}/>
          <HtRRow label="Forward Kur" value={htFmt2(r.forwardKur)} accent={C.blue}/>
          <HtRRow label="Swap Puanı" value={htFmt2(r.swapPuani)} accent={r.swapPuani>=0?C.green:C.red}/>
          <HtRRow label="Swap Puanı (%)" value={`%${htFmt2(r.swapPuaniYuzde)}`}/>
          <HtRRow label="Yıllıklandırılmış Getiri/Maliyet" value={`%${htFmt2(r.yillikGetiri)}`} accent={C.purple} big/>
        </Card>
      )}

      <div style={{background:C.orangeLight,borderRadius:10,padding:"10px 14px"}}>
        <p style={{margin:0,fontSize:11,color:C.orange,lineHeight:1.5}}>
          📐 Swap puanı, faiz farkından (TRY faizi − döviz faizi) kaynaklanır.
        </p>
      </div>
    </div>
  );
}

// 4. HAZİNE BONOSU / TAHVİL BASİT GETİRİ HESAPLAMA
function HtHazineBonosu(){
  const [nominal,setNominal]=useState("100000");
  const [oran,setOran]=useState("");
  const [gun,setGun]=useState("182");

  const r=useMemo(()=>{
    const N=parseFloat(nominal.replace(",","."));
    const r_=parseFloat(oran.replace(",","."));
    const G=parseInt(gun);
    if(!N||!r_||!G) return null;

    // Basit iskonto: Fiyat = Nominal × (1 - oran×gün/365)
    const iskontoluFiyat=N*(1-(r_/100)*(G/365));
    const iskontoTutari=N-iskontoluFiyat;
    // Efektif (bileşik) yıllık getiri: alış fiyatından nominale ulaşmak için gereken bileşik oran
    const efektifGetiri=((N/iskontoluFiyat)-1)*(365/G)*100;

    return {N,iskontoluFiyat,iskontoTutari,efektifGetiri,G,oran:r_};
  },[nominal,oran,gun]);

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <SecTitle>İşlem Bilgileri</SecTitle>
        <HtField label="Nominal Değer (İtfa Tutarı)" value={nominal} onChange={setNominal} suffix="₺"/>
        <HtField label="Basit Faiz Oranı (Yıllık)" value={oran} onChange={setOran} suffix="%"/>
        <HtField label="Vadeye Kalan Gün" value={gun} onChange={setGun} suffix="Gün"/>
      </Card>

      {r && (
        <Card>
          <SecTitle>Hesaplama Sonucu</SecTitle>
          <div style={{textAlign:"center",padding:"12px 0",background:C.blueLight,borderRadius:10,marginBottom:10}}>
            <p style={{margin:0,fontSize:12,color:C.sub}}>İskontolu Alış Fiyatı</p>
            <p style={{margin:"4px 0 0",fontSize:26,fontWeight:900,color:C.blue,fontFamily:"monospace"}}>{htFmtTL(r.iskontoluFiyat)}</p>
          </div>
          <HtRRow label="Nominal Değer (Vade Sonu)" value={htFmtTL(r.N)}/>
          <HtRRow label="İskonto Tutarı (Kazanç)" value={htFmtTL(r.iskontoTutari)} accent={C.green}/>
          <HtRRow label="Basit Faiz Oranı (Yıllık)" value={`%${htFmt2(r.oran)}`}/>
          <HtRRow label="Efektif Yıllık Getiri (Bileşik)" value={`%${htFmt2(r.efektifGetiri)}`} accent={C.purple} big/>
          <HtRRow label="Vade" value={`${r.G} Gün`} sub/>
        </Card>
      )}

      <div style={{background:C.orangeLight,borderRadius:10,padding:"10px 14px"}}>
        <p style={{margin:0,fontSize:11,color:C.orange,lineHeight:1.5}}>
          📐 Formül: Fiyat = Nominal × (1 − Oran × Gün/365). Efektif getiri, iskontolu alış fiyatından nominale ulaşmak için gereken bileşik yıllık oranı gösterir; basit orandan her zaman biraz yüksektir.
        </p>
      </div>
    </div>
  );
}

// 5. KUR HAREKETİ SENARYO ANALİZİ
function HtKurSenaryo(){
  const [tutar,setTutar]=useState("100000");
  const [paraBirimi,setParaBirimi]=useState("USD");
  const [spotKur,setSpotKur]=useState("");
  const [senaryolar,setSenaryolar]=useState(["-10","-5","0","5","10"]);
  const [yukleniyor,setYukleniyor]=useState(true);

  useEffect(()=>{
    fetch("/api/kur").then(r=>r.ok?r.json():null).then(d=>{
      if(d){
        const kurMap:any = {
          USD: d.USD_TRY, EUR: d.EUR_TRY, GBP: d.GBP_TRY,
          XAU: d.XAU_TRY_gram, XAG: d.XAG_TRY_gram,
        };
        const kur = kurMap[paraBirimi];
        if(kur) setSpotKur(String(kur).replace(".",","));
      }
      setYukleniyor(false);
    }).catch(()=>setYukleniyor(false));
  },[paraBirimi]);

  const senaryoSonuclari=useMemo(()=>{
    const T=parseFloat(tutar.replace(",","."));
    const S=parseFloat(spotKur.replace(",","."));
    if(!T||!S) return [];
    const mevcutTL=T*S;
    return senaryolar.map(s=>{
      const yuzde=parseFloat(s.replace(",","."));
      if(isNaN(yuzde)) return null;
      const yeniKur=S*(1+yuzde/100);
      const yeniTL=T*yeniKur;
      const fark=yeniTL-mevcutTL;
      return {yuzde,yeniKur,yeniTL,fark};
    }).filter(x=>x!==null);
  },[tutar,spotKur,senaryolar]);

  const senaryoGuncelle=(idx:number,deger:string)=>{
    const yeni=[...senaryolar];
    yeni[idx]=deger.replace(/[^0-9,.-]/g,"");
    setSenaryolar(yeni);
  };
  const senaryoEkle=()=>setSenaryolar([...senaryolar,"0"]);
  const senaryoSil=(idx:number)=>setSenaryolar(senaryolar.filter((_,i)=>i!==idx));

  const T=parseFloat(tutar.replace(",","."));
  const S=parseFloat(spotKur.replace(",","."));
  const mevcutTL = T&&S ? T*S : null;

  const PARA_ETIKET:any = {USD:"USD",EUR:"EUR",GBP:"GBP",XAU:"Altın (gram)",XAG:"Gümüş (gram)"};
  const tutarBirimi = paraBirimi==="XAU"||paraBirimi==="XAG" ? "gram" : paraBirimi;

  return(
    <div style={{padding:"0 16px 32px"}}>
      <Card>
        <SecTitle>Pozisyon Bilgileri</SecTitle>
        <HtField label={`Pozisyon Tutarı (${tutarBirimi})`} value={tutar} onChange={setTutar}/>
        <div style={{marginBottom:10}}>
          <label style={{display:"block",fontSize:11,color:C.sub,marginBottom:4}}>Para Birimi / Emtia</label>
          <select value={paraBirimi} onChange={e=>setParaBirimi(e.target.value)}
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.card,fontSize:14,fontWeight:700,color:C.blue,outline:"none"}}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="XAU">Altın (gram)</option>
            <option value="XAG">Gümüş (gram)</option>
          </select>
        </div>
        <HtField label={`Spot Fiyat (${PARA_ETIKET[paraBirimi]}/TRY)${yukleniyor?" — yükleniyor...":""}`} value={spotKur} onChange={setSpotKur} suffix="TRY"/>
        {mevcutTL!=null && (
          <div style={{textAlign:"center",padding:"10px 0",background:C.blueLight,borderRadius:10,marginTop:8}}>
            <p style={{margin:0,fontSize:11,color:C.sub}}>Mevcut TL Karşılığı</p>
            <p style={{margin:"2px 0 0",fontSize:18,fontWeight:800,color:C.blue,fontFamily:"monospace"}}>{htFmtTL(mevcutTL)}</p>
          </div>
        )}
      </Card>

      <Card>
        <SecTitle>Senaryolar (%)</SecTitle>
        {senaryolar.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <input value={s} onChange={e=>senaryoGuncelle(i,e.target.value)} placeholder="örn. 5 veya -5"
              inputMode="decimal"
              style={{flex:1,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.card,fontSize:14,fontWeight:600,outline:"none"}}/>
            <span style={{fontSize:13,color:C.sub,fontWeight:700}}>%</span>
            {senaryolar.length>1 && (
              <button onClick={()=>senaryoSil(i)} style={{background:"rgba(248,113,113,0.12)",border:"none",width:32,height:32,borderRadius:8,color:C.red,fontSize:16,cursor:"pointer"}}>×</button>
            )}
          </div>
        ))}
        <button onClick={senaryoEkle} style={{width:"100%",padding:"10px",borderRadius:10,border:`1.5px dashed ${C.border}`,background:"transparent",color:C.sub,fontWeight:600,fontSize:13,cursor:"pointer"}}>+ Senaryo Ekle</button>
      </Card>

      {senaryoSonuclari.length>0 && (
        <Card>
          <SecTitle>Senaryo Sonuçları</SecTitle>
          {senaryoSonuclari.map((r:any,i)=>(
            <div key={i} style={{
              display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"10px 12px",marginBottom:6,borderRadius:10,
              background:r.fark>=0?C.greenLight:"rgba(248,113,113,0.12)",
            }}>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:r.fark>=0?C.green:C.red}}>{r.yuzde>=0?"+":""}{r.yuzde}%</p>
                <p style={{margin:"2px 0 0",fontSize:10,color:C.sub}}>Kur: {htFmt2(r.yeniKur)}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{margin:0,fontSize:14,fontWeight:800,color:r.fark>=0?C.green:C.red,fontFamily:"monospace"}}>
                  {r.fark>=0?"+":""}{htFmtTL(r.fark)}
                </p>
                <p style={{margin:"2px 0 0",fontSize:10,color:C.sub}}>{htFmtTL(r.yeniTL)} TL toplam</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div style={{background:C.orangeLight,borderRadius:10,padding:"10px 14px"}}>
        <p style={{margin:0,fontSize:11,color:C.orange,lineHeight:1.5}}>
          📐 Her senaryo, spot kurun girilen yüzde kadar değişmesi durumunda pozisyonunuzun TL karşılığındaki değişimi gösterir. Pozitif yüzde kurun yükselmesini (TL'nin değer kaybetmesini) ifade eder.
        </p>
      </div>
    </div>
  );
}

// ANA HAZİNE İŞLEMLERİ MENÜSÜ
// ─── PİYASA HABERLERİ (HİBRİT — TR STATİK TAKVİM + US/EU DİNAMİK) ──────────────
function ayinIlkIsGunuSonrasi(yil:number, ay:number, gun:number){
  let d = new Date(yil, ay, gun);
  while(d.getDay()===0 || d.getDay()===6){ d.setDate(d.getDate()+1); }
  return d;
}
function ayinSonIsGunu(yil:number, ay:number){
  let d = new Date(yil, ay+1, 0);
  while(d.getDay()===0 || d.getDay()===6){ d.setDate(d.getDate()-1); }
  return d;
}
function turkiyeStatikTakvim(){
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const liste:any[] = [];
  const baslangicYil = bugun.getFullYear();
  const baslangicAy = bugun.getMonth();

  for(let i=-1;i<=12;i++){
    const ref = new Date(baslangicYil, baslangicAy+i, 1);
    const yil = ref.getFullYear(), ay = ref.getMonth();
    const ekle=(tarih:Date,saat:string,baslik:string,etki:string)=>liste.push({
      tarih: tarih.toISOString(), ulke:"TRY", ulkeAdi:"Türkiye", baslik, baslikOrijinal:baslik,
      etki: etki==="yuksek"?"High":etki==="orta"?"Medium":"Low",
      etkiAdi: etki==="yuksek"?"Yüksek":etki==="orta"?"Orta":"Düşük",
      etkiRenk: etki==="yuksek"?"#D32F2F":etki==="orta"?"#F57C00":"#388E3C",
      tahmin:null, onceki:null, gerceklesen:null, kaynakTR:true,
    });
    ekle(ayinIlkIsGunuSonrasi(yil,ay,3), "10:00", "Tüketici Fiyat Endeksi (TÜFE) Açıklaması — TÜİK", "yuksek");
    ekle(ayinIlkIsGunuSonrasi(yil,ay,3), "10:00", "Yurt İçi Üretici Fiyat Endeksi (Yİ-ÜFE) — TÜİK", "orta");
    ekle(ayinIlkIsGunuSonrasi(yil,ay,8), "10:00", "Sanayi Üretim Endeksi — TÜİK", "orta");
    ekle(ayinIlkIsGunuSonrasi(yil,ay,11), "10:00", "İşsizlik Oranı — TÜİK", "orta");
    ekle(ayinIlkIsGunuSonrasi(yil,ay,12), "10:00", "Ödemeler Dengesi İstatistikleri — TCMB", "orta");
    ekle(ayinIlkIsGunuSonrasi(yil,ay,25), "10:00", "Konut Fiyat Endeksi (KFE) — TCMB", "dusuk");
    ekle(ayinIlkIsGunuSonrasi(yil,ay,30), "10:00", "Dış Ticaret Dengesi (Geçici) — TÜİK", "yuksek");
    ekle(ayinSonIsGunu(yil,ay), "10:00", "Reel Kesim Güven Endeksi & Kapasite Kullanım Oranı — TCMB", "orta");
  }
  const PPK_2026=[
    new Date(2026,0,22),new Date(2026,2,12),new Date(2026,3,22),
    new Date(2026,5,11),new Date(2026,6,23),new Date(2026,8,10),
    new Date(2026,9,22),new Date(2026,11,10),
  ];
  PPK_2026.forEach(t=>liste.push({
    tarih: new Date(t.getFullYear(),t.getMonth(),t.getDate(),14,0).toISOString(),
    ulke:"TRY", ulkeAdi:"Türkiye", baslik:"Para Politikası Kurulu (PPK) Faiz Kararı — TCMB", baslikOrijinal:"PPK",
    etki:"High", etkiAdi:"Yüksek", etkiRenk:"#D32F2F", tahmin:null, onceki:null, gerceklesen:null, kaynakTR:true,
  }));

  // 2026 Finansal Takvimi — kredi notu değerlendirmeleri, vergi son günleri, raporlar, resmi tatiller
  const ekle2026=(tarih:Date,saat:string,baslik:string,etki:string)=>liste.push({
    tarih: new Date(tarih.getFullYear(),tarih.getMonth(),tarih.getDate(),
      parseInt(saat.split(":")[0]),parseInt(saat.split(":")[1])).toISOString(),
    ulke:"TRY", ulkeAdi:"Türkiye", baslik, baslikOrijinal:baslik,
    etki: etki==="yuksek"?"High":etki==="orta"?"Medium":"Low",
    etkiAdi: etki==="yuksek"?"Yüksek":etki==="orta"?"Orta":"Düşük",
    etkiRenk: etki==="yuksek"?"#D32F2F":etki==="orta"?"#F57C00":"#388E3C",
    tahmin:null, onceki:null, gerceklesen:null, kaynakTR:true,
  });

  ekle2026(new Date(2026,0,23), "18:00", "Fitch + Moody's Türkiye Kredi Notu Değerlendirmesi", "yuksek");
  ekle2026(new Date(2026,1,2), "23:59", "MTV (Motorlu Taşıtlar Vergisi) Son Ödeme Günü", "dusuk");
  ekle2026(new Date(2026,1,17), "23:59", "Kurumlar Vergisi Geçici Vergi Dönemi (1. Dönem)", "dusuk");
  ekle2026(new Date(2026,3,17), "18:00", "S&P Global Türkiye Kredi Notu Değerlendirmesi", "yuksek");
  ekle2026(new Date(2026,3,30), "23:59", "2025 Yılı Kurumlar Vergisi Beyanname Son Günü", "orta");
  ekle2026(new Date(2026,4,18), "23:59", "Kurumlar Vergisi Geçici Vergi Dönemi (2. Dönem)", "dusuk");
  ekle2026(new Date(2026,4,22), "10:00", "Finansal İstikrar Raporu — TCMB", "orta");
  ekle2026(new Date(2026,4,31), "23:59", "Emlak Vergisi 1. Taksit Son Ödeme Günü", "dusuk");
  ekle2026(new Date(2026,6,17), "18:00", "Fitch Türkiye Kredi Notu Değerlendirmesi", "yuksek");
  ekle2026(new Date(2026,6,24), "18:00", "Moody's Türkiye Kredi Notu Değerlendirmesi", "yuksek");
  ekle2026(new Date(2026,6,31), "23:59", "MTV (Motorlu Taşıtlar Vergisi) 2. Taksit Son Ödeme Günü", "dusuk");
  ekle2026(new Date(2026,7,17), "23:59", "Kurumlar Vergisi Geçici Vergi Dönemi (3. Dönem)", "dusuk");
  ekle2026(new Date(2026,9,16), "18:00", "S&P Global Türkiye Kredi Notu Değerlendirmesi", "yuksek");
  ekle2026(new Date(2026,10,17), "23:59", "Kurumlar Vergisi Geçici Vergi Dönemi (4. Dönem)", "dusuk");
  ekle2026(new Date(2026,10,27), "10:00", "Finansal İstikrar Raporu — TCMB", "orta");
  ekle2026(new Date(2026,10,30), "23:59", "Emlak Vergisi 2. Taksit Son Ödeme Günü", "dusuk");

  // Resmi tatiller / dini bayramlar (piyasa kapanışı/yarım gün ihtimali nedeniyle bilgi amaçlı)
  ekle2026(new Date(2026,2,20), "00:00", "Ramazan Bayramı Başlangıcı (20-22 Mart)", "dusuk");
  ekle2026(new Date(2026,4,27), "00:00", "Kurban Bayramı Başlangıcı (27-30 Mayıs)", "dusuk");

  return liste.filter(e=>new Date(e.tarih)>=bugun).sort((a,b)=>new Date(a.tarih).getTime()-new Date(b.tarih).getTime());
}

function PiyasaHaberleri(){
  const [ekranModu,setEkranModu]=useState<"haberler"|"takvim">("haberler");
  const [haberlerAPI,setHaberlerAPI]=useState<any[]>([]);
  const [yukleniyor,setYukleniyor]=useState(true);
  const [hata,setHata]=useState<string|null>(null);
  const [ulkeFiltre,setUlkeFiltre]=useState<"tumu"|"TRY"|"USD"|"EUR">("tumu");
  const [guncelleme,setGuncelleme]=useState<string|null>(null);

  const [haberler,setHaberler]=useState<any[]>([]);
  const [haberYukleniyor,setHaberYukleniyor]=useState(true);
  const [haberHata,setHaberHata]=useState<string|null>(null);
  const [haberGuncelleme,setHaberGuncelleme]=useState<string|null>(null);

  useEffect(()=>{
    fetch("/api/finans-haberleri").then(r=>r.ok?r.json():null).then(d=>{
      if(d && d.success){
        setHaberler(d.data||[]);
        setHaberGuncelleme(d.guncelleme);
      } else {
        setHaberHata("Haberler alınamadı");
      }
      setHaberYukleniyor(false);
    }).catch(()=>{setHaberHata("Bağlantı hatası");setHaberYukleniyor(false);});
  },[]);

  useEffect(()=>{
    fetch("/api/piyasa-haberleri").then(r=>r.ok?r.json():null).then(d=>{
      if(d && d.success){
        setHaberlerAPI(d.data||[]);
        setGuncelleme(d.guncelleme);
      } else {
        setHata("Veri alınamadı");
      }
      setYukleniyor(false);
    }).catch(()=>{setHata("Bağlantı hatası");setYukleniyor(false);});
  },[]);

  // TR sekmesi: statik TCMB/TÜİK takvimi (her zaman dolu, güvenilir)
  // US/EUR sekmesi ve Tümü: API'den gelen dinamik veri + TR statik birleşik
  const turkiyeTakvimi = useMemo(()=>turkiyeStatikTakvim(),[]);
  const tumHaberler = useMemo(()=>{
    const usEu = haberlerAPI.filter(h=>h.ulke==="USD"||h.ulke==="EUR");
    return [...turkiyeTakvimi, ...usEu].sort((a,b)=>new Date(a.tarih).getTime()-new Date(b.tarih).getTime());
  },[haberlerAPI,turkiyeTakvimi]);

  const MONTHS=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const DAYS=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
  const formatTarihSaat=(iso:string)=>{
    const d=new Date(iso);
    const saat=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
    return {gun:`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`, saat};
  };

  const filtreli = ulkeFiltre==="tumu" ? tumHaberler : tumHaberler.filter(h=>h.ulke===ulkeFiltre);

  const gruplu:Record<string,any[]> = {};
  filtreli.forEach(h=>{
    const {gun} = formatTarihSaat(h.tarih);
    if(!gruplu[gun]) gruplu[gun]=[];
    gruplu[gun].push(h);
  });

  const ULKE_BAYRAK:Record<string,string> = {TRY:"🇹🇷",USD:"🇺🇸",EUR:"🇪🇺"};

  const formatHaberTarih=(iso:string)=>{
    const d=new Date(iso);
    const simdi=new Date();
    const farkDk=Math.round((simdi.getTime()-d.getTime())/60000);
    if(farkDk<1) return "az önce";
    if(farkDk<60) return `${farkDk} dk önce`;
    const farkSaat=Math.round(farkDk/60);
    if(farkSaat<24) return `${farkSaat} sa önce`;
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  return(
    <div style={{background:"#0B0E14",minHeight:"100dvh",paddingBottom:32}}>
      <div style={{background:"linear-gradient(135deg,#1A1A2E 0%,#16213E 100%)",padding:"16px 16px 14px",borderBottom:"2px solid #FF6B35"}}>
        <p style={{margin:"0 0 2px",fontSize:11,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.07em"}}>Katılım Analiz</p>
        <h2 style={{margin:0,fontSize:18,fontWeight:800,color:"#fff",display:"flex",alignItems:"center",gap:8}}>
          📡 Piyasa Haberleri
        </h2>
        <p style={{margin:"4px 0 0",fontSize:11,color:"rgba(255,255,255,0.55)"}}>
          {ekranModu==="haberler"
            ? `Bloomberg HT ${haberGuncelleme && `· Güncelleme: ${new Date(haberGuncelleme).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}`}`
            : `🇹🇷 Türkiye + 🇺🇸 ABD + 🇪🇺 Avrupa ${guncelleme && `· Güncelleme: ${new Date(guncelleme).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}`}`}
        </p>
      </div>

      <div style={{display:"flex",gap:6,padding:"12px 16px 0"}}>
        <button onClick={()=>setEkranModu("haberler")} style={{
          flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${ekranModu==="haberler"?"#FF6B35":"#2A2F3E"}`,
          background:ekranModu==="haberler"?"rgba(255,107,53,0.15)":"transparent",
          color:ekranModu==="haberler"?"#FF6B35":"#9CA3AF",
          fontWeight:ekranModu==="haberler"?700:500,fontSize:13,cursor:"pointer"
        }}>📰 Haberler</button>
        <button onClick={()=>setEkranModu("takvim")} style={{
          flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${ekranModu==="takvim"?"#FF6B35":"#2A2F3E"}`,
          background:ekranModu==="takvim"?"rgba(255,107,53,0.15)":"transparent",
          color:ekranModu==="takvim"?"#FF6B35":"#9CA3AF",
          fontWeight:ekranModu==="takvim"?700:500,fontSize:13,cursor:"pointer"
        }}>📅 Takvim</button>
      </div>

      {ekranModu==="haberler" && (
        <div style={{padding:"14px 16px"}}>
          {haberYukleniyor && (
            <div style={{textAlign:"center",padding:40,color:"#9CA3AF",fontSize:13}}>⏳ Haberler yükleniyor...</div>
          )}
          {!haberYukleniyor && haberHata && (
            <div style={{textAlign:"center",padding:40,color:"#F87171",fontSize:13}}>⚠️ {haberHata}</div>
          )}
          {!haberYukleniyor && !haberHata && haberler.map((h,i)=>(
            <a key={i} href={h.link} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
              <div style={{
                padding:"12px 14px",marginBottom:8,
                background:"#151823",borderRadius:10,borderLeft:"3px solid #FF6B35",
              }}>
                <p style={{margin:0,fontSize:14,fontWeight:700,color:"#F3F4F6",lineHeight:1.35}}>{h.baslik}</p>
                {h.ozet && <p style={{margin:"6px 0 0",fontSize:12,color:"#9CA3AF",lineHeight:1.4}}>{h.ozet}</p>}
                {h.tarih && <p style={{margin:"6px 0 0",fontSize:10,color:"#6B7280"}}>🕐 {formatHaberTarih(h.tarih)}</p>}
              </div>
            </a>
          ))}
        </div>
      )}

      {ekranModu==="takvim" && (
      <>
      <div style={{display:"flex",gap:6,padding:"12px 16px 0",overflowX:"auto"}}>
        {[
          {v:"tumu" as const,l:"Tümü"},
          {v:"TRY" as const,l:"🇹🇷 Türkiye"},
          {v:"USD" as const,l:"🇺🇸 ABD"},
          {v:"EUR" as const,l:"🇪🇺 Avrupa"},
        ].map(f=>(
          <button key={f.v} onClick={()=>setUlkeFiltre(f.v)} style={{
            flex:"0 0 auto",padding:"8px 12px",borderRadius:8,border:`1.5px solid ${ulkeFiltre===f.v?"#FF6B35":"#2A2F3E"}`,
            background:ulkeFiltre===f.v?"rgba(255,107,53,0.15)":"transparent",
            color:ulkeFiltre===f.v?"#FF6B35":"#9CA3AF",
            fontWeight:ulkeFiltre===f.v?700:500,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"
          }}>{f.l}</button>
        ))}
      </div>

      <div style={{padding:"14px 16px"}}>
        {yukleniyor && (
          <div style={{textAlign:"center",padding:20,color:"#9CA3AF",fontSize:12}}>⏳ ABD/Avrupa verileri yükleniyor, Türkiye takvimi hazır...</div>
        )}
        {!yukleniyor && hata && ulkeFiltre!=="TRY" && (
          <div style={{textAlign:"center",padding:20,color:"#F87171",fontSize:12}}>⚠️ ABD/Avrupa verisi alınamadı, Türkiye takvimi gösteriliyor</div>
        )}
        {!yukleniyor && filtreli.length===0 && (
          <div style={{textAlign:"center",padding:40,color:"#9CA3AF",fontSize:13}}>Kayıt bulunamadı</div>
        )}

        {Object.entries(gruplu).map(([gun,olaylar])=>(
          <div key={gun} style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:4,height:16,background:"#FF6B35",borderRadius:2}}/>
              <p style={{margin:0,fontSize:13,fontWeight:800,color:"#fff",letterSpacing:"0.02em"}}>{gun}</p>
            </div>
            {olaylar.map((h,i)=>{
              const {saat}=formatTarihSaat(h.tarih);
              return(
                <div key={i} style={{
                  display:"flex",gap:10,padding:"10px 12px",marginBottom:6,
                  background:"#151823",borderRadius:10,borderLeft:`3px solid ${h.etkiRenk}`,
                }}>
                  <div style={{minWidth:42,textAlign:"center"}}>
                    <p style={{margin:0,fontSize:12,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{saat}</p>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:11}}>{ULKE_BAYRAK[h.ulke]||""}</span>
                      <span style={{fontSize:9,fontWeight:700,color:"#fff",background:"#2A2F3E",padding:"1px 6px",borderRadius:4}}>{h.ulke}</span>
                      <span style={{fontSize:9,fontWeight:700,color:h.etkiRenk}}>{h.etkiAdi==="Yüksek"?"●●●":h.etkiAdi==="Orta"?"●●":"●"}</span>
                    </div>
                    <p style={{margin:0,fontSize:13,fontWeight:600,color:"#E5E7EB",lineHeight:1.3}}>{h.baslik}</p>
                    {(h.tahmin||h.onceki) && (
                      <div style={{display:"flex",gap:12,marginTop:4}}>
                        {h.tahmin && <span style={{fontSize:10,color:"#9CA3AF"}}>Beklenti: <b style={{color:"#D1D5DB"}}>{h.tahmin}</b></span>}
                        {h.onceki && <span style={{fontSize:10,color:"#9CA3AF"}}>Önceki: <b style={{color:"#D1D5DB"}}>{h.onceki}</b></span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{margin:"0 16px",padding:"10px 14px",background:"#151823",borderRadius:10}}>
        <p style={{margin:0,fontSize:10,color:"#6B7280",lineHeight:1.5}}>
          📡 Türkiye verileri TCMB ve TÜİK'in resmi veri yayımlama takvimine göre hesaplanmaktadır (tarihler resmi tatilde kayabilir). ABD ve Avrupa verileri Forex Factory ekonomik takviminden canlı çekilmektedir. Yatırım tavsiyesi değildir.
        </p>
      </div>
      </>
      )}
    </div>
  );
}

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────
// ─── POS KÂRLILİK ANALİZİ ────────────────────────────────────────────────────
function PosHesaplama({s}){
  const [ciro,       setCiro]       = useState("");  // ZORUNLU - aylık POS cirosu
  const [komisyon,   setKomisyon]   = useState("");  // uygulanan komisyon %
  const [blokGun,    setBlokGun]    = useState("");  // bloke / valör gün
  const [cariOrt,    setCariOrt]    = useState("");  // cari hesap aylık ortalama ₺
  const [vadOrt,     setVadOrt]     = useState("");  // vadeli katılım aylık ortalama ₺
  const [cariKarPay, setCariKarPay] = useState(()=>String(s.cariKarPayiOran||35));
  const [vadKarPay,  setVadKarPay]  = useState(()=>String(s.katilimKarPayiOran||2));

  const referans   = parseFloat(s.referansOran) || 3.11;
  const bkmTakas   = parseFloat(s.bkmTakas)     || 3.36;
  const AZAMI_KOM  = parseFloat((referans + 0.45).toFixed(4));
  const AZAMI_BLOK = 40;

  const ciroVal  = parseFloat(ciro)      || 0;
  const komVal   = parseFloat(komisyon)  || 0;
  const blokVal  = parseFloat(blokGun)   || 0;
  const cariVal  = parseFloat(cariOrt)   || 0;
  const vadVal   = parseFloat(vadOrt)    || 0;
  const cariKO   = (parseFloat(cariKarPay) || 0) / 12;  // aylık %
  const vadKO    = (parseFloat(vadKarPay)  || 0) / 12;  // aylık %

  // ── Kural kontrolleri ─────────────────────────────────────────────────────
  // Müşteri efektif maliyet: komisyon × (1 + blokGün/30) ≤ 3,56
  // Tebliğ formülü: maxKom = (1 - blokGün/AZAMI_BLOK) × AZAMI_KOM
  // 40 gün → maxKom=0, 39 gün → maxKom=%0.089, 0 gün → maxKom=%3.56
  const efektifMusteri = komVal; // direkt komisyon kontrolü (komVal > maxKomForBlok)

  // Max izinli komisyon bu bloke için
  const maxKomForBlok = parseFloat((AZAMI_KOM * (1 - blokVal / AZAMI_BLOK)).toFixed(4));

  // Max izinli bloke bu komisyon için: 30 × (3,56/komisyon - 1), max 40 gün
  const maxBlokForKom = komVal > 0
    ? Math.min(Math.floor(AZAMI_BLOK * (1 - komVal / AZAMI_KOM)), AZAMI_BLOK)
    : AZAMI_BLOK;

  const hatalar = [];

  if(komisyon !== "" && komVal > AZAMI_KOM)
    hatalar.push(`Komisyon oranı tavanı %${fmtN(AZAMI_KOM,4)}'i aşıyor.`);

  if(blokGun !== "" && blokVal > AZAMI_BLOK)
    hatalar.push(`Bloke gün sayısı tavanı ${AZAMI_BLOK} günü aşıyor.`);

  // İkisi de girilmişse kombinasyon kontrolü
  if(komisyon !== "" && blokGun !== "" && komVal > maxKomForBlok){
    hatalar.push(
      `%${fmtN(komVal,4)} komisyon + ${blokVal} gün bloke geçersiz — tebliğ gereği max komisyon %${fmtN(maxKomForBlok,4)} olmalıdır.\n` +
      `• Bu komisyon için maksimum bloke: ${Math.max(0,maxBlokForKom)} gün\n` +
      `• Bu bloke için maksimum komisyon: %${fmtN(maxKomForBlok,4)}`
    );
  }

  // İki alan da dolu mu (0 dahil geçerli)
  const girislerTam = komisyon !== "" && blokGun !== "";

  // ── Hesap ─────────────────────────────────────────────────────────────────
  const r = useCallback(()=>{
    if(!ciroVal || !girislerTam) return null;

    // 1. BKM TAKAS MALİYETİ
    const bkmMaliyet = ciroVal * bkmTakas / 100;

    // 2. KOMİSYON GELİRİ — banka tam komisyonu alır, bloke ayrı gelir
    const efKom = komVal; // banka komisyonu tam tahsil eder
    const komisyonGeliri = ciroVal * efKom / 100;

    // 3. BLOKE GÜN FAYDA GELİRİ
    //    Formül: Ciro × blokGün × fonlama_oranı / 36500
    //    Bloke > 14 gün ise ZK oranı uygulanır (vadesiz ZK: zkTL_vadesiz)
    const fonlamaOran = parseFloat(s.fonlamaMaliyeti) || 24.0;
    const zkBlokeOran = blokVal > 14 ? (parseFloat(s.zkTL_vadesiz) || 17) / 100 : 0;
    const ciroKullanilabilir = ciroVal * (1 - zkBlokeOran);
    // Bloke getirisi: cari hesap kâr payı oranı kullanılır (fonlama maliyeti yerine)
    const blokeKarPayiOran = parseFloat(cariKarPay) || fonlamaOran;
    const blokeGeliri = blokVal > 0 ? ciroKullanilabilir * blokVal * blokeKarPayiOran / 36500 : 0;

    // 4. CARİ HESAP GELİRİ
    //    ZK oranı düşüldükten sonra kalan tutar üzerinden hesapla
    //    Cari = vadesiz → ZK oranı: zkTL_vadesiz
    const zkCariOran = (parseFloat(s.zkTL_vadesiz) || 17) / 100;
    const cariKullanilabilir = cariVal * (1 - zkCariOran);
    const cariGelir = cariKullanilabilir * cariKO / 100;

    // 5. VADELİ KATILIM GELİRİ
    //    Vadeli → ZK oranı: zkTL_6ay
    const zkVadOran = (parseFloat(s.zkTL_6ay) || 10) / 100;
    const vadKullanilabilir = vadVal * (1 - zkVadOran);
    const vadGelir = vadKullanilabilir * vadKO / 100;

    // 6. TOPLAM GELİR & MALİYET
    const toplamGelir   = komisyonGeliri + blokeGeliri + cariGelir + vadGelir;
    // 6b. DİĞER MALİYETLER (Visa/MC komisyonu, bakım vb.)
    // Ciro × ‱5 (onbinde 5)
    const digerMaliyet = Math.round(ciroVal * 0.0005 * 100) / 100;
    const toplamMaliyet = bkmMaliyet + digerMaliyet;

    // 7. NET KÂR / ZARAR
    const netSonuc = toplamGelir - toplamMaliyet;

    // 8. ÖNERİLER (sadece zarar varsa)
    // Zararı sıfırlamak için gereken minimum ek gelir
    const zararTutar = netSonuc < 0 ? Math.abs(netSonuc) : 0;

    // A) Komisyon oranı önerisi (bloke sabit, komisyon artır)
    // Gereken toplam komisyon geliri = toplamMaliyet - blokeGeliri
    const onerKomHam = (toplamMaliyet - blokeGeliri) / ciroVal * 100;
    // Efektif maliyet tavan kontrolü: onerKom * (1 + blokVal/30) ≤ AZAMI_KOM
    // Tebliğ: maxKomForBlok = AZAMI_KOM * (1 - blokGün/AZAMI_BLOK)
    const efektifOnerKom = onerKomHam; // artık doğrudan komVal ile kıyaslanır
    const onerKom = Math.min(parseFloat(onerKomHam.toFixed(4)), maxKomForBlok);
    const onerKomYeterli = onerKomHam <= maxKomForBlok;
    const onerKomEfektifAsim = onerKomHam > maxKomForBlok && onerKomHam <= AZAMI_KOM;

    // B) Bloke gün önerisi — mevcut bloke üzerine ek gün
    const zkOranBlok = (parseFloat(s.zkTL_vadesiz) || 17) / 100;
    // Max izinli TOPLAM bloke gün (mevcut komisyon için)
    const maxBlokForKomOner = komVal > 0
      ? Math.min(Math.floor(AZAMI_BLOK * (1 - komVal / AZAMI_KOM)), AZAMI_BLOK)
      : AZAMI_BLOK;

    // Mevcut bloke geliri zaten hesaplanmış (blokeGeliri)
    // Sadece EK GELİR GEREKİYOR = zararTutar
    // Ek bloke geliri = ciroKull * ekGun * fonlamaOran / 36500 = zararTutar
    // ekGun = zararTutar * 36500 / (ciroKull * fonlamaOran)
    const ciroKullMevcut = blokVal > 14 ? ciroVal*(1-zkOranBlok) : ciroVal;
    const ekGunZksiz = zararTutar * 36500 / (ciroVal * blokeKarPayiOran);
    const ekGunZkli  = zararTutar * 36500 / (ciroVal*(1-zkOranBlok) * fonlamaOran);

    // Toplam bloke hedefi
    let toplamBlokHedef, onerBlokZkUygulanir;
    // Check if adding ekGunZksiz keeps us ≤14 total
    if(blokVal + Math.ceil(ekGunZksiz) <= 14){
      toplamBlokHedef = blokVal + Math.ceil(ekGunZksiz);
      onerBlokZkUygulanir = false;
    } else {
      // ZK applies on total — need to recalculate from scratch with ZK
      // Toplam blok = (blokeGeliri_mevcut + zararTutar) * 36500 / (ciro*(1-zk)*fonlama)
      const toplamGelirHedef = blokeGeliri + zararTutar;
      toplamBlokHedef = Math.ceil(toplamGelirHedef * 36500 / (ciroVal*(1-zkOranBlok)*blokeKarPayiOran));
      onerBlokZkUygulanir = true;
    }

    const onerEkGun = Math.max(0, toplamBlokHedef - blokVal);
    const onerBlokToplam = toplamBlokHedef;

    // Tavan kontrolü: mevcut komisyon + toplamBlokHedef ≤ AZAMI_KOM?
    const efektifYeni = komVal * (1 + toplamBlokHedef / 30);
    let onerBlok, onerBlokKombine=null;

    if(blokVal >= AZAMI_BLOK){
      // Bloke zaten maksimumda → B = sadece komisyon artır (A ile aynı)
      onerBlok = blokVal;
    } else if(efektifYeni <= AZAMI_KOM && toplamBlokHedef <= AZAMI_BLOK){
      // Sadece bloke yeterli
      onerBlok = toplamBlokHedef;
    } else {
      // Tavan aşılıyor → max izinli bloke + ek komisyon
      const blokKombine = Math.min(maxBlokForKomOner, AZAMI_BLOK);
      const ciroKullK = blokKombine > 14 ? ciroVal*(1-zkOranBlok) : ciroVal;
      const blokeGeliriK = ciroKullK * blokKombine * blokeKarPayiOran / 36500;
      const kalanZarar = toplamMaliyet - komisyonGeliri - blokeGeliriK;
      const ekKomOran = kalanZarar > 0 ? kalanZarar / ciroVal * 100 : 0;
      const kombineKom = parseFloat((komVal + ekKomOran).toFixed(4));
      const kombineEfektif = parseFloat((kombineKom * (1 + blokKombine / 30)).toFixed(4));
      onerBlok = blokKombine;
      onerBlokKombine = {
        blok: blokKombine, ekGun: Math.max(0,blokKombine-blokVal),
        kom: kombineKom, efektif: kombineEfektif,
        tavanAsim: kombineEfektif > AZAMI_KOM,
      };
    }
    const onerBlokYeterli = !onerBlokKombine && onerBlok <= AZAMI_BLOK;
    const onerEkGunGoster = onerBlok - blokVal;

    // C) Cari hesap bakiyesi önerisi (komisyon+bloke sabit, cari bakiye artır)
    // Ek cari gelir = onerCariBakiye × (1-zkCariOran) × cariKO/100 = zararTutar
    // onerCariBakiye = zararTutar / ((1-zkCariOran) × cariKO/100)
    const onerCariBakiye = cariKO > 0
      ? Math.ceil(zararTutar / ((1-zkCariOran) * cariKO / 100) / 1000) * 1000
      : null;

    // D) Vadeli katılım bakiyesi önerisi
    // onerVadBakiye = zararTutar / ((1-zkVadOran) × vadKO/100)
    const onerVadBakiye = vadKO > 0
      ? Math.ceil(zararTutar / ((1-zkVadOran) * vadKO / 100) / 1000) * 1000
      : null;

    return{
      ciroVal, komVal, blokVal, efKom: komVal,
      bkmMaliyet, digerMaliyet, komisyonGeliri, blokeGeliri, blokeKarPayiOran, cariGelir, vadGelir,
      toplamGelir, toplamMaliyet, netSonuc, zararTutar,
      onerKom, onerKomYeterli, onerKomEfektifAsim, efektifOnerKom, onerBlok, onerBlokYeterli, onerBlokZkUygulanir, onerBlokKombine, onerEkGunGoster, onerBlokMaks:blokVal>=AZAMI_BLOK&&maxKomForBlok<=0,
      onerCariBakiye, onerVadBakiye,
      cariVal, vadVal, cariKO, vadKO,
      fonlamaOran,
      zkCariOran, zkVadOran,
      cariKullanilabilir, vadKullanilabilir,
      zkBlokeOran, ciroKullanilabilir,
    };
  },[ciro,komisyon,blokGun,cariOrt,vadOrt,cariKarPay,vadKarPay,s.referansOran,s.bkmTakas])();

  return(
    <div style={{padding:"0 16px 32px"}}>

      {/* GİRİŞ */}
      <Card>
        <SecTitle>POS Cirosu (Zorunlu)</SecTitle>
        <Field label="Aylık POS Cirosu" value={ciro} onChange={setCiro} suffix="₺"
          hint="Tüm hesaplama bu ciroya göre yapılır"/>
      </Card>

      <Card>
        <SecTitle>Komisyon & Bloke</SecTitle>
        <Field label="Uygulanacak Komisyon Oranı" value={komisyon} onChange={setKomisyon}
          suffix="%" hint={`Tavan: %${fmtN(AZAMI_KOM,4)} — BKM Takas: %${fmtN(bkmTakas,2)}${girislerTam && blokVal>0 ? ` — ${blokVal} gün bloke için max: %${fmtN(maxKomForBlok,4)} · Efektif: kom×(1+gün/30)≤${fmtN(AZAMI_KOM,4)}` : ""}`}/>
        <Field label="Bloke / Valör Gün Sayısı" value={blokGun} onChange={setBlokGun}
          suffix="Gün" hint={`Tavan: ${AZAMI_BLOK} gün${girislerTam && komVal>0 ? ` — %${fmtN(komVal,4)} komisyon için max: ${Math.max(0,maxBlokForKom)} gün` : ""}`}/>
        {hatalar.map((h,i)=>(
          <div key={i} style={{background:"rgba(248,113,113,0.12)",borderRadius:8,padding:"8px 10px",marginBottom:4,border:`1px solid ${C.red}`}}>
            <p style={{margin:0,fontSize:11,color:C.red,fontWeight:700}}>⛔ {h}</p>
          </div>
        ))}
      </Card>

      <Card>
        <SecTitle>Hesap Ortalamaları</SecTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="Cari Ortalama" value={cariOrt} onChange={setCariOrt} suffix="₺"/>
          <Field label="Cari Kâr Payı" value={cariKarPay} onChange={setCariKarPay} suffix="% Yıllık"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="Katılım Ortalama" value={vadOrt} onChange={setVadOrt} suffix="₺"/>
          <Field label="Katılım Kâr Payı" value={vadKarPay} onChange={setVadKarPay} suffix="% Yıllık"/>
        </div>
      </Card>

      {/* SONUÇLAR */}
      {r && hatalar.length === 0 && girislerTam && (
        <>
          <Card>
            <SecTitle>Kâr / Zarar Analizi</SecTitle>

            {/* MALİYET */}
            <div style={{background:"rgba(248,113,113,0.12)",borderRadius:10,padding:"11px 14px",marginBottom:10}}>
              <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.red,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                📤 Maliyet
              </p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.sub}}>BKM Takas ({fmtTL(r.ciroVal)} × %{fmtN(bkmTakas,2)})</span>
                <span style={{fontSize:15,fontWeight:800,color:C.red,fontFamily:"monospace"}}>- {fmtTL(r.bkmMaliyet)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderTop:`1px solid ${C.border}`}}>
                <span style={{fontSize:12,color:C.sub}}>Diğer Maliyetler (Visa/MC, bakım vb. — cirosunun ‱5)</span>
                <span style={{fontSize:15,fontWeight:800,color:C.red,fontFamily:"monospace"}}>- {fmtTL(r.digerMaliyet)}</span>
              </div>
            </div>

            {/* GELİRLER */}
            <div style={{background:C.greenLight,borderRadius:10,padding:"11px 14px",marginBottom:10}}>
              <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                📥 Gelirler
              </p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:12,color:C.sub}}>
                  Komisyon ({fmtTL(r.ciroVal)} × %{fmtN(r.komVal,4)})
                </span>
                <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:"monospace"}}>+ {fmtTL(r.komisyonGeliri)}</span>
              </div>
              {r.blokVal > 0 && (
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:12,color:C.sub}}>
                    Bloke Faydası ({fmtTL(r.ciroKullanilabilir)} × {r.blokVal} gün × %{fmtN(r.blokeKarPayiOran,2)} (Cari KP) ÷ 36500
                    {r.zkBlokeOran>0?` — ZK %${fmtN(r.zkBlokeOran*100,0)} düşüldü`:""})
                  </span>
                  <span style={{fontSize:14,fontWeight:700,color:C.teal,fontFamily:"monospace"}}>+ {fmtTL(r.blokeGeliri)}</span>
                </div>
              )}
              {r.cariVal > 0 && r.cariKO > 0 && (
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:12,color:C.sub}}>
                    Cari ({fmtTL(r.cariKullanilabilir)} × %{fmtN(r.cariKO,4)}/ay — ZK %{fmtN(r.zkCariOran*100,0)} düşüldü)
                  </span>
                  <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:"monospace"}}>+ {fmtTL(r.cariGelir)}</span>
                </div>
              )}
              {r.vadVal > 0 && r.vadKO > 0 && (
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:C.sub}}>
                    Vadeli ({fmtTL(r.vadKullanilabilir)} × %{fmtN(r.vadKO,4)}/ay — ZK %{fmtN(r.zkVadOran*100,0)} düşüldü)
                  </span>
                  <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:"monospace"}}>+ {fmtTL(r.vadGelir)}</span>
                </div>
              )}
              {r.blokVal > 0 && (
                <div style={{background:"rgba(91,155,216,0.10)",borderRadius:8,padding:"8px 10px",marginTop:6}}>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>
                    Formül: Ciro × Bloke Gün × Oran ÷ 36500 — Oran: %{fmtN(r.fonlamaOran,2)} (Ayarlar → Fonlama Maliyeti)
                  </p>
                </div>
              )}
              <div style={{height:1,background:"rgba(0,0,0,0.08)",margin:"8px 0"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:C.green}}>Toplam Gelir</span>
                <span style={{fontSize:15,fontWeight:800,color:C.green,fontFamily:"monospace"}}>+ {fmtTL(r.toplamGelir)}</span>
              </div>
            </div>

            {/* NET SONUÇ */}
            <div style={{
              background: r.netSonuc >= 0 ? "#F0FDF4" : "rgba(248,113,113,0.12)",
              borderRadius:14, padding:"16px",
              border:`2.5px solid ${r.netSonuc >= 0 ? C.green : C.red}`
            }}>
              <p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",
                color: r.netSonuc >= 0 ? C.green : C.red}}>
                {r.netSonuc >= 0 ? "✅ NET KÂR" : "❌ NET ZARAR"}
              </p>
              <p style={{margin:0,fontSize:32,fontWeight:900,fontFamily:"monospace",
                color: r.netSonuc >= 0 ? C.green : C.red}}>
                {r.netSonuc >= 0 ? "+" : ""}{fmtTL(r.netSonuc)}
              </p>
              <p style={{margin:"6px 0 0",fontSize:11,color:C.sub}}>
                Aylık net — {fmtTL(r.ciroVal)} ciro üzerinden
              </p>
            </div>
          </Card>

          {/* ÖNERİLER — sadece zarar varsa */}
          {r.netSonuc < 0 && (
          <Card>
            <SecTitle>💡 Zararı Sıfırlama Önerileri</SecTitle>
            <p style={{margin:"0 0 10px",fontSize:12,color:C.sub}}>
              Aylık {fmtTL(r.zararTutar)} zararı gidermek için aşağıdaki seçeneklerden biri yeterli:
            </p>

            {/* A: Komisyon */}
            <div style={{background:r.onerKomYeterli?C.blueLight:r.onerKomEfektifAsim?"rgba(248,113,113,0.12)":"rgba(224,165,61,0.12)",borderRadius:10,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${r.onerKomYeterli?C.blue:r.onerKomEfektifAsim?C.red:C.orange}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:r.onerKomYeterli?C.blue:r.onerKomEfektifAsim?C.red:C.orange}}>
                    {r.onerKomYeterli?"✅":r.onerKomEfektifAsim?"⛔":"⚠️"} A) Komisyon Oranını Artır
                  </p>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>Bloke değişmez, komisyon yukarı çekilir</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{margin:0,fontSize:22,fontWeight:900,color:r.onerKomYeterli?C.blue:r.onerKomEfektifAsim?C.red:C.orange,fontFamily:"monospace"}}>
                    %{fmtN(r.onerKom,4)}
                  </p>
                  {r.onerKomEfektifAsim&&<p style={{margin:0,fontSize:10,color:C.red}}>max: %{fmtN(maxKomForBlok,4)}</p>}
                </div>
              </div>
              {r.onerKomEfektifAsim&&<p style={{margin:"6px 0 0",fontSize:10,color:C.red}}>⛔ Tebliğ gereği {blokVal} gün bloke ile max komisyon %{fmtN(maxKomForBlok,4)} olabilir. B) seçeneğini kullanın.</p>}
              {!r.onerKomYeterli&&!r.onerKomEfektifAsim&&<p style={{margin:"6px 0 0",fontSize:10,color:C.orange}}>⚠️ Tavan %{fmtN(AZAMI_KOM,4)} — bu oran tek başına yetmez</p>}
            </div>

            {/* B: Bloke */}
            <div style={{background:r.onerBlokMaks?"rgba(248,113,113,0.12)":r.onerBlokKombine?C.orangeLight:r.onerBlokYeterli?C.blueLight:"rgba(224,165,61,0.12)",borderRadius:10,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${r.onerBlokMaks?C.red:r.onerBlokKombine?C.orange:r.onerBlokYeterli?C.blue:C.orange}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
                <div style={{flex:1}}>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:r.onerBlokMaks?C.red:r.onerBlokKombine?C.orange:r.onerBlokYeterli?C.blue:C.orange}}>
                    {r.onerBlokMaks?"⛔":r.onerBlokKombine?"⚡":"✅"} B) {r.onerBlokMaks?"Bloke Maksimumda":r.onerBlokKombine?"Bloke + Komisyon Kombine":"Bloke Gün Sayısını Artır"}
                  </p>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>
                    {r.onerBlokMaks
                      ? `Bloke ${AZAMI_BLOK} gün tavanda — komisyon da %0,00 zorunlu`
                      : r.onerBlokKombine
                      ? `Max izinli toplam: ${r.onerBlok} gün (+${r.onerBlokKombine.ekGun} gün) + ek komisyon`
                      : `Mevcut ${blokVal} gün → ${r.onerBlok} gün (+${r.onerEkGunGoster} gün)${r.onerBlokZkUygulanir?" · ZK %17 dahil":""}`}
                  </p>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{textAlign:"right"}}>
                    <p style={{margin:0,fontSize:11,color:C.sub}}>{r.onerBlok} gün toplam</p>
                    {r.onerBlokMaks
                    ? <p style={{margin:0,fontSize:11,fontWeight:700,color:C.red}}>Tebliğ gereği bu kombinasyonda kazanç mümkün değil. C/D seçeneklerini değerlendirin.</p>
                    : r.onerEkGunGoster===0&&!r.onerBlokKombine
                    ? <p style={{margin:0,fontSize:13,fontWeight:700,color:C.sub}}>Bloke maks. · Kom. artır</p>
                    : <p style={{margin:0,fontSize:18,fontWeight:900,color:r.onerBlokKombine?C.orange:r.onerBlokYeterli?C.blue:C.orange,fontFamily:"monospace"}}>
                        +{r.onerBlokKombine?r.onerBlokKombine.ekGun:r.onerEkGunGoster} gün
                      </p>}
                    {r.onerBlokKombine&&<p style={{margin:0,fontSize:13,fontWeight:800,color:r.onerBlokKombine.tavanAsim?C.red:C.orange,fontFamily:"monospace"}}>
                      %{fmtN(r.onerBlokKombine.kom,4)} kom.
                    </p>}
                  </div>
                </div>
              </div>
              {r.onerBlokKombine&&<div style={{marginTop:8,padding:"6px 10px",background:"rgba(0,0,0,0.05)",borderRadius:8}}>
                <p style={{margin:0,fontSize:10,color:r.onerBlokKombine.tavanAsim?C.red:C.sub}}>
                  {r.onerBlokKombine.tavanAsim
                    ? `⛔ Bu kombine efektif maliyet %${fmtN(r.onerBlokKombine.efektif,4)} — tavan aşılıyor, komisyon oranını artırın`
                    : `Efektif maliyet: %${fmtN(r.onerBlokKombine.efektif,4)} ✓ — tavan ${fmtN(AZAMI_KOM,4)} içinde`}
                </p>
              </div>}
              {!r.onerBlokYeterli&&!r.onerBlokKombine&&<p style={{margin:"6px 0 0",fontSize:10,color:C.orange}}>⚠️ Tavan {AZAMI_BLOK} gün — bu süre tek başına yetmez</p>}
            </div>

            {/* C: Cari hesap */}
            {r.onerCariBakiye&&<div style={{background:C.greenLight,borderRadius:10,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${C.green}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:C.green}}>✅ C) Cari Hesap Bakiyesi Getir</p>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>%{fmtN(parseFloat(cariKarPay),2)} yıllık oranla, ZK düşüldükten sonra</p>
                </div>
                <p style={{margin:0,fontSize:22,fontWeight:900,color:C.green,fontFamily:"monospace"}}>
                  {new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0,minimumFractionDigits:0}).format(r.onerCariBakiye)}
                </p>
              </div>
            </div>}

            {/* D: Vadeli katılım */}
            {r.onerVadBakiye&&<div style={{background:"rgba(167,139,250,0.12)",borderRadius:10,padding:"12px 14px",border:`1.5px solid ${C.purple}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:C.purple}}>✅ D) Katılım Hesabı Bakiyesi Getir</p>
                  <p style={{margin:0,fontSize:10,color:C.sub}}>%{fmtN(parseFloat(vadKarPay),2)} yıllık oranla, ZK düşüldükten sonra</p>
                </div>
                <p style={{margin:0,fontSize:22,fontWeight:900,color:C.purple,fontFamily:"monospace"}}>
                  {new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0,minimumFractionDigits:0}).format(r.onerVadBakiye)}
                </p>
              </div>
            </div>}

            {!r.onerCariBakiye&&!r.onerVadBakiye&&<p style={{margin:"8px 0 0",fontSize:11,color:C.sub}}>
              💡 C ve D önerileri için hesap ortalamaları ve kâr payı oranlarını girin
            </p>}
          </Card>
          )}

          <RaporButon baslik="POS Kârlılık Analizi" plan={null} satirlar={[
            {label:"Aylık POS Cirosu", value:fmtTL(r.ciroVal), big:true},
            {label:`Komisyon Geliri (%${fmtN(r.efKom,4)} efektif)`, value:fmtTL(r.komisyonGeliri)},
            r.blokeGeliri>0?{label:`Bloke Gün Faydası (${r.blokVal} gün)`, value:fmtTL(r.blokeGeliri)}:null,
            r.cariGelir>0?{label:"Cari Hesap Geliri", value:fmtTL(r.cariGelir)}:null,
            r.vadGelir>0?{label:"Vadeli Katılım Geliri", value:fmtTL(r.vadGelir)}:null,
            {label:"Toplam Gelir", value:fmtTL(r.toplamGelir)},
            {label:`BKM Takas Maliyeti (%${fmtN(bkmTakas,2)})`, value:`- ${fmtTL(r.bkmMaliyet)}`},
            {label:"NET SONUÇ", value:`${r.netSonuc>=0?"+":""}${fmtTL(r.netSonuc)}`, big:true},
          ].filter(Boolean)}/>
        </>
      )}

      {(!ciroVal || !girislerTam) && (
        <div style={{background:C.blueLight,borderRadius:12,padding:"14px 16px",border:`1.5px solid ${C.blue}`}}>
          <p style={{margin:0,fontSize:13,color:C.blue,fontWeight:700}}>
            {!ciroVal ? "ℹ️ Aylık POS cirosunu girerek başlayın." : "ℹ️ Komisyon ve bloke gün sayısı zorunludur (0 yazılabilir)."}
          </p>
        </div>
      )}
    </div>
  );
}
// Artifact ortamında CORS nedeniyle dış API çalışmaz.
// Vercel serverless function üzerinden kur çekiyoruz (CORS sorunu yok)
const fetchKurlarViaClaudeAPI = async () => {
  try {
    const res = await fetch("/api/kur");
    if (!res.ok) return null;
    return await res.json();
  } catch(e) {
    return null;
  }
};

function gecmisKaydet(gecmis, setGecmis, kayit){
  const yeni = {
    id: Date.now(),
    tarih: new Date().toLocaleString("tr-TR"),
    ...kayit
  };
  setGecmis(prev => {
    const updated = [yeni, ...prev.filter(g=>g.id!==yeni.id)].slice(0,10);
    try{ localStorage.setItem("vk_gecmis", JSON.stringify(updated)); }catch(e){}
    return updated;
  });
}

// ─── BİLDİRİM MODAL ─────────────────────────────────────────────────────────
// ─── KUR GRAFİK MODAL ────────────────────────────────────────────────────────
function KurGrafikModal({kur, onClose}:{kur:any, onClose:()=>void}){
  const [veri,setVeri]=useState<any>(null);
  const [yukleniyor,setYukleniyor]=useState(true);
  const [tooltip,setTooltip]=useState<any>(null);
  const fmt2=(n:any)=>n==null?"—":new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

  // Sembol haritası
  const sembolMap:any={
    "USD":"USDTRY=X","EUR":"EURTRY=X","GBP":"GBPTRY=X",
    "SAR":"SARTRY=X","AED":"AEDTRY=X","100 JPY":"JPYTRY=X",
    "Altın (g)":"GC=F","Gümüş (g)":"SI=F","BTC":"BTC-USD",
    "USD/TRY":"USDTRY=X","EUR/TRY":"EURTRY=X","GBP/TRY":"GBPTRY=X",
    "Altın/TRY (Gram)":"GRAM_ALTIN","Gümüş/TRY (Gram)":"GRAM_GUMUS","Ons Altın/USD":"GC=F",
  };
  const sembol=kur.sembol||sembolMap[kur.kod]||kur.kod;

  useEffect(()=>{
    setYukleniyor(true);
    fetch(`/api/gecmis?sembol=${encodeURIComponent(sembol)}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>{setVeri(d);setYukleniyor(false);})
      .catch(()=>setYukleniyor(false));
  },[sembol]);

  const noktalar=veri?.noktalar||[];
  const fiyatlar=noktalar.map((n:any)=>n.fiyat).filter(Boolean);
  const minF=Math.min(...fiyatlar);
  const maxF=Math.max(...fiyatlar);
  const aralik=maxF-minF||1;
  const degisim=veri?.guncelFiyat&&veri?.oncekiKapanis?
    ((veri.guncelFiyat-veri.oncekiKapanis)/veri.oncekiKapanis*100).toFixed(2):null;
  const pozitif=degisim&&parseFloat(degisim)>=0;

  const W=320, H=140, PAD=8;
  const getX=(i:number)=>PAD+(i/(noktalar.length-1||1))*(W-PAD*2);
  const getY=(f:number)=>H-PAD-((f-minF)/aralik)*(H-PAD*2);

  const pathD=noktalar.length>1?noktalar.map((n:any,i:number)=>
    `${i===0?"M":"L"}${getX(i).toFixed(1)},${getY(n.fiyat).toFixed(1)}`
  ).join(" "):"";

  const areaD=noktalar.length>1?`${pathD} L${getX(noktalar.length-1).toFixed(1)},${H} L${getX(0).toFixed(1)},${H} Z`:"";

  const etiket=kur.kripto?"USD":kur.altin?"TL":"TL";

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:600,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        {/* Başlık */}
        <div style={{padding:"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <p style={{margin:0,fontSize:18,fontWeight:800,color:"#F1F5F9"}}>
              {kur.emtia ? (kur.ad || kur.kod)
                : kur.kod?.includes("/") ? kur.kod
                : kur.altin ? kur.kod
                : kur.kripto ? kur.kod+"/USD"
                : kur.kod+"/TRY"}
            </p>
            <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.55)"}}>Son 30 Gün</p>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 20px 32px"}}>
          {yukleniyor?(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <p style={{color:"rgba(255,255,255,0.55)",fontSize:14}}>⏳ Yükleniyor...</p>
            </div>
          ):!veri||noktalar.length===0?(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <p style={{color:"#F87171",fontSize:14}}>Veri alınamadı</p>
            </div>
          ):(
            <>
              {/* Özet */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px"}}>
                  <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.55)",fontWeight:600}}>GÜNCEL FİYAT</p>
                  <p style={{margin:"4px 0 0",fontSize:16,fontWeight:800,color:"#F1F5F9",fontFamily:"monospace"}}>{fmt2(veri.guncelFiyat)}</p>
                  <p style={{margin:"2px 0 0",fontSize:10,color:"#9CA3AF"}}>{veri.para} cinsinden</p>
                </div>
                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px"}}>
                  <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.55)",fontWeight:600}}>ÖNCEKİ KAPANIS</p>
                  <p style={{margin:"4px 0 0",fontSize:16,fontWeight:800,color:"#F1F5F9",fontFamily:"monospace"}}>{fmt2(veri.oncekiKapanis)}</p>
                  <p style={{margin:"2px 0 0",fontSize:10,color:"#9CA3AF"}}>{noktalar[noktalar.length-2]?.tarih||"—"}</p>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 10px"}}>
                  <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.55)",fontWeight:600}}>30G EN DÜŞÜK</p>
                  <p style={{margin:"3px 0 0",fontSize:13,fontWeight:800,color:"#1C3A5E",fontFamily:"monospace"}}>{fmt2(minF)}</p>
                  <p style={{margin:"1px 0 0",fontSize:9,color:"#9CA3AF"}}>{noktalar.find((n:any)=>n.fiyat===minF)?.tarih||"—"}</p>
                </div>
                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 10px"}}>
                  <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.55)",fontWeight:600}}>30G EN YÜKSEK</p>
                  <p style={{margin:"3px 0 0",fontSize:13,fontWeight:800,color:"#1C3A5E",fontFamily:"monospace"}}>{fmt2(maxF)}</p>
                  <p style={{margin:"1px 0 0",fontSize:9,color:"#9CA3AF"}}>{noktalar.find((n:any)=>n.fiyat===maxF)?.tarih||"—"}</p>
                </div>
                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 10px"}}>
                  <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.55)",fontWeight:600}}>30G DEĞİŞİM</p>
                  <p style={{margin:"3px 0 0",fontSize:13,fontWeight:800,color:noktalar.length>1&&noktalar[noktalar.length-1].fiyat>noktalar[0].fiyat?"#16A34A":"#DC2626",fontFamily:"monospace"}}>
                    {noktalar.length>1?`${noktalar[noktalar.length-1].fiyat>noktalar[0].fiyat?"+":""}${((noktalar[noktalar.length-1].fiyat-noktalar[0].fiyat)/noktalar[0].fiyat*100).toFixed(1)}%`:"—"}
                  </p>
                  <p style={{margin:"1px 0 0",fontSize:9,color:"#9CA3AF"}}>{noktalar[0]?.tarih} - {noktalar[noktalar.length-1]?.tarih}</p>
                </div>
              </div>

              {degisim&&<div style={{background:pozitif?"#F0FDF4":"rgba(248,113,113,0.12)",borderRadius:10,padding:"8px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>{pozitif?"📈":"📉"}</span>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:pozitif?"#16A34A":"#DC2626"}}>
                  Günlük Değişim: {pozitif?"+":""}{degisim}%
                </p>
              </div>}

              {/* Grafik */}
              <div style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px 8px 4px",overflow:"hidden"}}>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block",touchAction:"none"}}
                onClick={(e)=>{
                  const rect=(e.target as SVGElement).closest("svg")!.getBoundingClientRect();
                  const x=((e.clientX-rect.left)/rect.width)*W;
                  const idx=Math.round((x-PAD)/(W-PAD*2)*(noktalar.length-1));
                  const i=Math.max(0,Math.min(noktalar.length-1,idx));
                  setTooltip(tooltip?.i===i?null:{i,n:noktalar[i],x:getX(i),y:getY(noktalar[i].fiyat)});
                }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={pozitif?"#16A34A":"#DC2626"} stopOpacity="0.3"/>
                      <stop offset="100%" stopColor={pozitif?"#16A34A":"#DC2626"} stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[0.25,0.5,0.75].map((r,i)=>(
                    <line key={i} x1={PAD} y1={PAD+(1-r)*(H-PAD*2)} x2={W-PAD} y2={PAD+(1-r)*(H-PAD*2)}
                      stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3,3"/>
                  ))}
                  {/* Area */}
                  <path d={areaD} fill="url(#grad)"/>
                  {/* Line */}
                  <path d={pathD} fill="none" stroke={pozitif?"#16A34A":"#DC2626"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                  {/* Son nokta */}
                  {noktalar.length>0&&(
                    <circle cx={getX(noktalar.length-1)} cy={getY(noktalar[noktalar.length-1].fiyat)}
                      r="4" fill={pozitif?"#16A34A":"#DC2626"} stroke="#fff" strokeWidth="2"/>
                  )}
                  {tooltip&&(
                    <>
                      <line x1={tooltip.x} y1={PAD} x2={tooltip.x} y2={H-PAD} stroke="#1C3A5E" strokeWidth="1" strokeDasharray="3,2"/>
                      <circle cx={tooltip.x} cy={tooltip.y} r="5" fill="#1C3A5E" stroke="#fff" strokeWidth="2"/>
                      <rect x={Math.min(tooltip.x+6,W-90)} y={Math.max(tooltip.y-28,4)} width={84} height={24} rx={5} fill="#1C3A5E"/>
                      <text x={Math.min(tooltip.x+48,W-48)} y={Math.max(tooltip.y-12,18)} textAnchor="middle" fontSize="9" fill="#fff" fontFamily="monospace">{tooltip.n.tarih} {fmt2(tooltip.n.fiyat)}</text>
                    </>
                  )}
                </svg>
                <div style={{display:"flex",justifyContent:"space-between",padding:"0 8px",marginTop:4}}>
                  <span style={{fontSize:9,color:"#9CA3AF"}}>{noktalar[0]?.tarih}</span>
                  <span style={{fontSize:9,color:"#9CA3AF"}}>{noktalar[noktalar.length-1]?.tarih}</span>
                </div>
              </div>
              <p style={{margin:"8px 0 0",fontSize:10,color:"#9CA3AF",textAlign:"center"}}>Kaynak: Yahoo Finance · {etiket} cinsinden</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ANA EKRANA EKLEME KILAVUZU MODAL ──────────────────────────────────────
function KurulumKilavuzuModal({onClose}){
  const Adim=({no,baslik,aciklama,renk}:{no:number,baslik:string,aciklama:any,renk:string})=>(
    <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
      <div style={{width:22,height:22,borderRadius:7,background:renk,color:"#0B131C",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{no}</div>
      <div>
        <p style={{margin:0,fontSize:13.5,fontWeight:700,color:"#F1F5F9"}}>{baslik}</p>
        <p style={{margin:"3px 0 0",fontSize:12,color:"rgba(255,255,255,0.55)",lineHeight:1.5}}>{aciklama}</p>
      </div>
    </div>
  );
  const UrlChip=()=>(<span style={{display:"inline-block",background:"rgba(91,155,216,0.15)",border:"1px solid rgba(91,155,216,0.3)",borderRadius:6,padding:"1px 6px",fontFamily:"monospace",color:"#8FC1F0",fontSize:11.5}}>katilim-analiz.vercel.app</span>);

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:"#F1F5F9"}}>📲 Ana Ekrana Ekleme Kılavuzu</span>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 18px 32px"}}>
          <p style={{margin:"0 0 18px",fontSize:12.5,color:"rgba(255,255,255,0.55)",lineHeight:1.6}}>
            Katılım Analiz bir tarayıcı uygulamasıdır; ana ekranınıza eklediğinizde diğer uygulamalar gibi tek dokunuşla, tam ekran açılır. App Store'a gerek yok.
          </p>

          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:16}}>📱</span>
            <span style={{fontSize:13,fontWeight:800,color:"#fff"}}>iPhone · Safari</span>
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 14px 4px",marginBottom:20}}>
            <Adim no={1} renk="#5B9BD8" baslik="Safari'de siteyi açın" aciklama={<>Adres çubuğuna <UrlChip/> yazıp açın.</>}/>
            <Adim no={2} renk="#5B9BD8" baslik="Paylaş ikonuna dokunun" aciklama="Ekranın alt orta çubuğundaki yukarı ok işaretli kare simgeye dokunun."/>
            <Adim no={3} renk="#5B9BD8" baslik={`"Ana Ekrana Ekle"yi seçin`} aciklama="Açılan listede aşağı kaydırıp bu seçeneğe dokunun."/>
            <Adim no={4} renk="#5B9BD8" baslik={`"Ekle" ile onaylayın`} aciklama="Sağ üstteki Ekle'ye dokunun — ikon ana ekranınıza düşer."/>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:16}}>🤖</span>
            <span style={{fontSize:13,fontWeight:800,color:"#fff"}}>Android · Chrome</span>
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 14px 4px",marginBottom:18}}>
            <Adim no={1} renk="#4ADE80" baslik="Chrome'da siteyi açın" aciklama={<>Adres çubuğuna <UrlChip/> yazıp açın.</>}/>
            <Adim no={2} renk="#4ADE80" baslik="Sağ üstteki ⋮ menüsüne dokunun" aciklama="Adres çubuğunun sağındaki üç nokta simgesine dokunun."/>
            <Adim no={3} renk="#4ADE80" baslik={`"Ana ekrana ekle" / "Uygulamayı yükle"`} aciklama="Menüden bu seçeneği bulup dokunun."/>
            <Adim no={4} renk="#4ADE80" baslik={`"Yükle"yi onaylayın`} aciklama="Çıkan pencerede onaylayın — ikon ana ekranınıza düşer."/>
          </div>

          <div style={{background:"rgba(91,155,216,0.08)",border:"1px solid rgba(91,155,216,0.25)",borderRadius:14,padding:"12px 14px",display:"flex",gap:10}}>
            <span style={{fontSize:15}}>💡</span>
            <p style={{margin:0,fontSize:11.5,color:"rgba(255,255,255,0.65)",lineHeight:1.6}}>
              Bir kez ekledikten sonra adres çubuğu ve sekmeler görünmez, tam ekran çalışır. Sorun yaşarsanız <b style={{color:"#F1F5F9"}}>Profil → Hata & Öneri Bildir</b>'den bize ulaşabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HakkindaModal({onClose}){
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:"#F1F5F9"}}>ℹ️ Hakkında</span>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 18px 32px"}}>
          {/* Geliştirici */}
          <div style={{display:"flex",alignItems:"center",gap:14,padding:"8px 0 16px"}}>
            <div style={{width:60,height:60,borderRadius:30,background:"#1C3A5E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>👨‍💼</div>
            <div>
              <p style={{margin:0,fontSize:17,fontWeight:800,color:"#F1F5F9"}}>Uğur YILMAZ</p>
            </div>
          </div>
          <div style={{height:1,background:"rgba(255,255,255,0.08)",marginBottom:14}}/>
          {/* İletişim */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            <a href="mailto:Katilimanalizz@gmail.com" style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}>
              <div style={{width:38,height:38,borderRadius:10,background:"rgba(91,155,216,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📧</div>
              <div>
                <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:600}}>E-Posta</p>
                <p style={{margin:0,fontSize:13,color:"#1C3A5E",fontWeight:700}}>Katilimanalizz@gmail.com</p>
              </div>
            </a>
            <a href="https://www.linkedin.com/in/u%C4%9Fur-yilmaz-62194b168" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}>
              <div style={{width:38,height:38,borderRadius:10,background:"rgba(91,155,216,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💼</div>
              <div>
                <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:600}}>LinkedIn</p>
                <p style={{margin:0,fontSize:13,color:"#1C3A5E",fontWeight:700}}>Uğur YILMAZ</p>
              </div>
            </a>
          </div>
          <div style={{height:1,background:"rgba(255,255,255,0.08)",marginBottom:14}}/>
          {/* Sürüm Notları */}
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:800,color:"#F1F5F9"}}>📋 Sürüm Notları</p>
          {[
            {v:"v1.3.0",t:"28 Haziran 2026",notlar:["Esnek ödeme planlarına USD/EUR/komisyon eklendi","Hata & Öneri bildirim sistemi","Vercel Analytics","Geçmiş paylaş aksiyonu","Hakkında ekranı"]},
            {v:"v1.2.0",t:"21 Haziran 2026",notlar:["Ara ödemeli plan bisection algoritması","Canlı altın/gümüş kurları","6 esnek ödeme planı modülü","PDF rapor & Apple Share"]},
            {v:"v1.1.0",t:"15 Haziran 2026",notlar:["Döviz finansmanı (USD/EUR)","POS kârlılık analizi","TM & Akreditif komisyon","Son hesaplamalar geçmişi"]},
            {v:"v1.0.0",t:"1 Haziran 2026",notlar:["İlk yayın","Katılım hesabı & finansman modülleri","Sukuk/kira sertifikası","PWA desteği"]},
          ].map((s,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:800,color:"#1C3A5E"}}>{s.v}</span>
                <span style={{fontSize:10,color:"#9CA3AF"}}>{s.t}</span>
              </div>
              {s.notlar.map((n,j)=>(
                <p key={j} style={{margin:"2px 0",fontSize:11,color:"rgba(255,255,255,0.55)"}}>• {n}</p>
              ))}
            </div>
          ))}
          <p style={{margin:"16px 0 0",fontSize:10,color:"#B0B8C8",textAlign:"center"}}>Katılım Analiz © 2026 — Tüm hakları saklıdır.</p>
        </div>
      </div>
    </div>
  );
}

function BildirimModal({onClose}){
  const [tip,setTip]=useState("hata");
  const [konu,setKonu]=useState("");
  const [mesaj,setMesaj]=useState("");
  const [durum,setDurum]=useState<"idle"|"sending"|"ok"|"err">("idle");

  const gonder=async()=>{
    if(!konu.trim()||!mesaj.trim()) return;
    setDurum("sending");
    try{
      const res=await fetch("https://api.emailjs.com/api/v1.0/email/send",{
        method:"POST",
        headers:{"Content-Type":"application/json","Origin":"https://katilim-analiz.vercel.app"},
        body:JSON.stringify({
          service_id:"service_a8q65p9",
          template_id:"template_ercpb1u",
          user_id:"9tP8nPG0LfoiO6nIA",
          template_params:{
            name:"Katilim Analiz Kullanicisi",
            email:"katilimanalizz@gmail.com",
            title:(tip==="hata"?"[HATA] ":"[ONERI] ")+konu,
            message:"Bildirim Tipi: "+(tip==="hata"?"Hata Bildirimi":"Oneri")+"\nKonu: "+konu+"\n\nMesaj:\n"+mesaj+"\n\nTarih: "+new Date().toLocaleString("tr-TR"),
          }
        })
      });
      if(res.ok) setDurum("ok");
      else setDurum("err");
    }catch(e){
      setDurum("err");
    }
  };

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:"#F1F5F9"}}>📣 Hata & Öneri Bildir</span>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:20,cursor:"pointer"}}>×</button>
        </div>

        {durum==="ok"?(
          <div style={{padding:"40px 24px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <p style={{fontSize:18,fontWeight:800,color:"#1A5C4A",margin:"0 0 8px"}}>Bildirim Alındı!</p>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.55)",margin:"0 0 24px"}}>Katkılarınız için teşekkür ederiz. En kısa sürede inceleyeceğiz.</p>
            <button onClick={onClose} style={{background:"#1C3A5E",color:"#fff",border:"none",padding:"12px 32px",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer"}}>Kapat</button>
          </div>
        ):durum==="err"?(
          <div style={{padding:"40px 24px",textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>❌</div>
            <p style={{fontSize:16,fontWeight:700,color:"#F87171",margin:"0 0 8px"}}>Gönderilemedi</p>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.55)",margin:"0 0 24px"}}>İnternet bağlantınızı kontrol edip tekrar deneyin.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setDurum("idle")} style={{background:"rgba(91,155,216,0.10)",color:"#F1F5F9",border:"none",padding:"11px 24px",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer"}}>Geri Dön</button>
              <button onClick={gonder} style={{background:"#1C3A5E",color:"#fff",border:"none",padding:"11px 24px",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer"}}>Tekrar Dene</button>
            </div>
          </div>
        ):(
          <div style={{flex:1,overflowY:"auto",padding:"16px 18px 8px"}}>
            {/* Tip seçimi */}
            <div style={{display:"flex",background:"rgba(255,255,255,0.08)",borderRadius:10,padding:3,marginBottom:16}}>
              {[{v:"hata",l:"🐛 Hata Bildir"},{v:"oneri",l:"💡 Öneri"}].map(o=>(
                <button key={o.v} onClick={()=>setTip(o.v)} style={{
                  flex:1,padding:"9px 4px",borderRadius:8,border:"none",cursor:"pointer",
                  background:tip===o.v?"#fff":"transparent",
                  color:tip===o.v?"#F1F5F9":"rgba(255,255,255,0.55)",
                  fontWeight:tip===o.v?700:500,fontSize:13,
                  boxShadow:tip===o.v?"0 1px 4px rgba(0,0,0,0.1)":"none",
                  transition:"all 0.15s"
                }}>{o.l}</button>
              ))}
            </div>

            {/* Konu */}
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5}}>
                {tip==="hata"?"Hata Konusu":"Öneri Konusu"}
              </label>
              <input value={konu} onChange={e=>setKonu(e.target.value)}
                placeholder={tip==="hata"?"Örn: Konut finansmanı hesaplama hatası":"Örn: Döviz finansmanı eklenmesi"}
                style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",fontSize:14,background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,color:"#F1F5F9",outline:"none"}}/>
            </div>

            {/* Mesaj */}
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5}}>
                {tip==="hata"?"Hata Detayı":"Öneri Detayı"}
              </label>
              <textarea value={mesaj} onChange={e=>setMesaj(e.target.value)}
                placeholder={tip==="hata"?"Ne yaptınız? Ne olmasını bekliyordunuz? Ne oldu?":"Önerinizi detaylıca açıklayın..."}
                rows={5}
                style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",fontSize:14,background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,color:"#F1F5F9",outline:"none",resize:"vertical",fontFamily:"inherit"}}/>
            </div>
          </div>
        )}

        {durum==="idle"&&(
          <div style={{padding:"12px 18px 32px",flexShrink:0}}>
            <button onClick={gonder} disabled={!konu.trim()||!mesaj.trim()} style={{
              width:"100%",padding:"14px",borderRadius:14,border:"none",
              background:(!konu.trim()||!mesaj.trim())?"#B0B8C8":"#1C3A5E",
              color:"#fff",fontWeight:800,fontSize:15,cursor:(!konu.trim()||!mesaj.trim())?"not-allowed":"pointer"
            }}>
              {tip==="hata"?"🐛 Hata Bildir":"💡 Öneri Gönder"}
            </button>
          </div>
        )}

        {durum==="sending"&&(
          <div style={{padding:"24px",textAlign:"center",flexShrink:0}}>
            <p style={{margin:0,fontSize:14,color:"rgba(255,255,255,0.55)"}}>⏳ Gönderiliyor...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PİYASA ÖZETİ KARTI (mini sparkline + günlük değişim) ──────────────────
function PiyasaOzetiKart({ad,sembol,paraOnek,dec,onTikla}:{ad:string,sembol:string,paraOnek?:string,dec:number,onTikla:()=>void}){
  const [veri,setVeri]=useState<any>(null);
  const [yukleniyor,setYukleniyor]=useState(true);

  useEffect(()=>{
    let iptal=false;
    setYukleniyor(true);
    fetch(`/api/gecmis?sembol=${encodeURIComponent(sembol)}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(!iptal){setVeri(d);setYukleniyor(false);}})
      .catch(()=>{if(!iptal)setYukleniyor(false);});
    return ()=>{iptal=true;};
  },[sembol]);

  const noktalar=veri?.noktalar||[];
  const fiyatlar=noktalar.map((n:any)=>n.fiyat).filter((f:any)=>typeof f==="number");
  const guncel=veri?.guncelFiyat??fiyatlar[fiyatlar.length-1];
  const oncekiKapanis=veri?.oncekiKapanis??fiyatlar[0];
  const degisim=(guncel!=null&&oncekiKapanis)?((guncel-oncekiKapanis)/oncekiKapanis*100):null;
  const pozitif=degisim!=null&&degisim>=0;

  const minF=fiyatlar.length?Math.min(...fiyatlar):0;
  const maxF=fiyatlar.length?Math.max(...fiyatlar):1;
  const aralik=(maxF-minF)||1;
  const W=100,H=26,PAD=2;
  const getX=(i:number)=>PAD+(i/(fiyatlar.length-1||1))*(W-PAD*2);
  const getY=(f:number)=>H-PAD-((f-minF)/aralik)*(H-PAD*2);
  const pathD=fiyatlar.length>1?fiyatlar.map((f:number,i:number)=>`${i===0?"M":"L"}${getX(i).toFixed(1)},${getY(f).toFixed(1)}`).join(" "):"";
  const renk=pozitif?"#4ADE80":"#F87171";

  const fmtDeger=(v:number)=>new Intl.NumberFormat("tr-TR",{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(v);

  return(
    <div onClick={onTikla} style={{
      background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:12,padding:"8px 7px 6px",cursor:"pointer",minWidth:0,
    }}>
      <p style={{margin:0,fontSize:8,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:0.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ad}</p>
      <p style={{margin:"3px 0 1px",fontSize:12,fontWeight:800,color:"#fff",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {guncel!=null?`${paraOnek||""}${fmtDeger(guncel)}`:(yukleniyor?"…":"—")}
      </p>
      <p style={{margin:"0 0 4px",fontSize:9,fontWeight:700,color:degisim!=null?renk:"rgba(255,255,255,0.3)"}}>
        {degisim!=null?`${pozitif?"+":""}${degisim.toFixed(2).replace(".",",")}%`:"—"}
      </p>
      <svg width="100%" height="18" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{display:"block"}}>
        {pathD&&<path d={pathD} fill="none" stroke={renk} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>}
      </svg>
    </div>
  );
}

// ─── FAVORİLERİM DÜZENLE MODAL ──────────────────────────────────────────────
function FavoriDuzenleModal({favoriler,onToggle,onClose}:{favoriler:string[],onToggle:(key:string)=>void,onClose:()=>void}){
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:"#15212E",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"82vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:"#fff"}}>⭐ Favorilerimi Düzenle</span>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",width:32,height:32,borderRadius:16,fontSize:18,color:"#fff",cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 18px 8px"}}>
          <p style={{margin:"0 0 14px",fontSize:11,color:"rgba(255,255,255,0.4)"}}>Ana sayfada kısayol olarak görünmesini istediğin araçları seç.</p>
          {HESAPLA_KATEGORILER.filter(k=>k.id!=="tumu"&&k.id!=="gecmis").map(kat=>{
            const items=HESAPLA_ARAC_LISTESI.filter(it=>it.kat===kat.id);
            if(items.length===0) return null;
            return(
              <div key={kat.id} style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>{kat.label}</div>
                {items.map(it=>{
                  const secili=favoriler.includes(it.key);
                  return(
                    <div key={it.key} onClick={()=>onToggle(it.key)} style={{
                      display:"flex",alignItems:"center",gap:12,
                      background:secili?"rgba(59,130,246,0.12)":"rgba(255,255,255,0.04)",
                      border:secili?"1px solid rgba(59,130,246,0.4)":"1px solid rgba(255,255,255,0.06)",
                      borderRadius:12,padding:"11px 12px",marginBottom:7,cursor:"pointer",
                    }}>
                      <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>{it.icon}</span>
                      <span style={{flex:1,fontSize:13,fontWeight:600,color:"#E8F0FA"}}>{it.label}</span>
                      <div style={{
                        width:20,height:20,borderRadius:6,flexShrink:0,
                        background:secili?"#3B82F6":"transparent",
                        border:secili?"none":"1.5px solid rgba(255,255,255,0.25)",
                        display:"flex",alignItems:"center",justifyContent:"center",
                      }}>
                        {secili&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{padding:"12px 18px 28px",flexShrink:0,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <button onClick={onClose} style={{width:"100%",padding:14,borderRadius:14,border:"none",background:"#3B82F6",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer"}}>
            Bitti ({favoriler.length} seçili)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PİYASALAR TABLOSU: kategori verisi ────────────────────────────────────
const PIYASA_TABLO_KATEGORILER = [
  {id:"doviz",       label:"Döviz"},
  {id:"emtia",       label:"Emtia"},
  {id:"borsa",       label:"Borsa"},
  {id:"fonlar",      label:"Fonlar"},
  {id:"kripto",      label:"Kripto"},
  {id:"gostergeler", label:"Göstergeler"},
];

const PIYASA_TABLO_VERISI:any = {
  doviz: [
    {ad:"USD/TRY", sembol:"USDTRY=X", dec:2},
    {ad:"EUR/TRY", sembol:"EURTRY=X", dec:2},
    {ad:"GBP/TRY", sembol:"GBPTRY=X", dec:2},
    {ad:"EUR/USD", sembol:"EURUSD=X", dec:4},
    {ad:"USD/JPY", sembol:"JPY=X",    dec:2},
  ],
  emtia: [
    {ad:"Altın (Ons)",   sembol:"GC=F", dec:2, paraOnek:"$"},
    {ad:"Gümüş (Ons)",   sembol:"SI=F", dec:3, paraOnek:"$"},
    {ad:"Brent Petrol",  sembol:"BZ=F", dec:2, paraOnek:"$"},
    {ad:"WTI Petrol",    sembol:"CL=F", dec:2, paraOnek:"$"},
    {ad:"Doğalgaz",      sembol:"NG=F", dec:3, paraOnek:"$"},
    {ad:"Bakır",         sembol:"HG=F", dec:3, paraOnek:"$"},
  ],
  borsa: [
    {ad:"BIST 100",  sembol:"XU100.IS", dec:0, paraOnek:"₺"},
    {ad:"S&P 500",   sembol:"^GSPC",    dec:2, paraOnek:"$"},
    {ad:"NASDAQ",    sembol:"^IXIC",    dec:2, paraOnek:"$"},
    {ad:"Dow Jones", sembol:"^DJI",     dec:0, paraOnek:"$"},
    {ad:"DAX",       sembol:"^GDAXI",   dec:2, paraOnek:"€"},
  ],
  kripto: [
    {ad:"Bitcoin",  sembol:"BTC-USD", dec:0, paraOnek:"$"},
    {ad:"Ethereum", sembol:"ETH-USD", dec:2, paraOnek:"$"},
  ],
};

// Tablo satırı: sembol solda, son fiyat + günlük % ortada, sparkline sağda
function PiyasaSatiri({ad,sembol,paraOnek,dec,onTikla}:{ad:string,sembol:string,paraOnek?:string,dec:number,onTikla:()=>void}){
  const [veri,setVeri]=useState<any>(null);
  const [yukleniyor,setYukleniyor]=useState(true);

  useEffect(()=>{
    let iptal=false;
    setYukleniyor(true);
    fetch(`/api/gecmis?sembol=${encodeURIComponent(sembol)}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(!iptal){setVeri(d);setYukleniyor(false);}})
      .catch(()=>{if(!iptal)setYukleniyor(false);});
    return ()=>{iptal=true;};
  },[sembol]);

  const noktalar=veri?.noktalar||[];
  const fiyatlar=noktalar.map((n:any)=>n.fiyat).filter((f:any)=>typeof f==="number");
  const guncel=veri?.guncelFiyat??fiyatlar[fiyatlar.length-1];
  const oncekiKapanis=veri?.oncekiKapanis??fiyatlar[0];
  const degisim=(guncel!=null&&oncekiKapanis)?((guncel-oncekiKapanis)/oncekiKapanis*100):null;
  const pozitif=degisim!=null&&degisim>=0;
  const renk=pozitif?"#4ADE80":"#F87171";

  const minF=fiyatlar.length?Math.min(...fiyatlar):0;
  const maxF=fiyatlar.length?Math.max(...fiyatlar):1;
  const aralik=(maxF-minF)||1;
  const W=80,H=24,PAD=2;
  const getX=(i:number)=>PAD+(i/(fiyatlar.length-1||1))*(W-PAD*2);
  const getY=(f:number)=>H-PAD-((f-minF)/aralik)*(H-PAD*2);
  const pathD=fiyatlar.length>1?fiyatlar.map((f:number,i:number)=>`${i===0?"M":"L"}${getX(i).toFixed(1)},${getY(f).toFixed(1)}`).join(" "):"";

  const fmtDeger=(v:number)=>new Intl.NumberFormat("tr-TR",{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(v);

  return(
    <div onClick={onTikla} style={{
      display:"flex",alignItems:"center",gap:8,padding:"12px 4px",
      borderBottom:"1px solid rgba(255,255,255,0.06)",cursor:"pointer",
    }}>
      <span style={{flex:1,fontSize:13,fontWeight:800,color:"#fff",minWidth:0}}>{ad}</span>
      <span style={{width:78,textAlign:"right",fontSize:13,fontWeight:700,color:"#E8F0FA",fontFamily:"monospace",flexShrink:0}}>
        {guncel!=null?`${paraOnek||""}${fmtDeger(guncel)}`:(yukleniyor?"…":"—")}
      </span>
      <span style={{width:60,textAlign:"right",fontSize:11,fontWeight:700,color:degisim!=null?renk:"rgba(255,255,255,0.3)",flexShrink:0}}>
        {degisim!=null?`${pozitif?"+":""}${degisim.toFixed(2).replace(".",",")}%`:"—"}
      </span>
      <svg width={56} height={22} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{flexShrink:0}}>
        {pathD&&<path d={pathD} fill="none" stroke={renk} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>}
      </svg>
    </div>
  );
}

function App(){
  const [screen,setScreen]=useState("home");
  const [menuAramaQ,setMenuAramaQ]=useState("");
  const [hesaplaAramaQ,setHesaplaAramaQ]=useState("");
  const [hesaplaFiltre,setHesaplaFiltre]=useState("tumu");
  const [favoriler,setFavoriler]=useState<string[]>(()=>{
    try{
      const kayit=localStorage.getItem("katilimAnaliz_favoriler_v1");
      if(kayit){const arr=JSON.parse(kayit); if(Array.isArray(arr)) return arr;}
    }catch{}
    return ["taksitliTicari","soikReeskont","hazineDoviz","konutFinansman"];
  });
  const [favoriDuzenleAcik,setFavoriDuzenleAcik]=useState(false);
  const [piyasaTabloFiltre,setPiyasaTabloFiltre]=useState("doviz");
  const [evdsMakro,setEvdsMakro]=useState<any>(null);
  useEffect(()=>{
    fetch("/api/evds-proxy")
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(d?.seriler) setEvdsMakro(d.seriler);})
      .catch(()=>{});
  },[]);
  const [piyasaTabloAramaQ,setPiyasaTabloAramaQ]=useState("");
  // Ana sayfa "Son Haberler" — en yeni 3 haber, periyodik yenilenir
  const [sonHaberler,setSonHaberler]=useState<any[]>([]);
  useEffect(()=>{
    const haberleriGetir=()=>{
      fetch("/api/finans-haberleri")
        .then(r=>r.ok?r.json():null)
        .then(d=>{
          if(d?.success && Array.isArray(d.data)){
            const siraliUc=[...d.data]
              .sort((a,b)=>new Date(b.tarih).getTime()-new Date(a.tarih).getTime())
              .slice(0,3);
            setSonHaberler(siraliUc);
          }
        })
        .catch(()=>{});
    };
    haberleriGetir();
    const t=setInterval(haberleriGetir,5*60*1000); // 5 dakikada bir yenile
    return ()=>clearInterval(t);
  },[]);
  useEffect(()=>{
    try{localStorage.setItem("katilimAnaliz_favoriler_v1",JSON.stringify(favoriler));}catch{}
  },[favoriler]);


  const [gecmis,setGecmis]=useState(()=>{
    try{
      const saved=localStorage.getItem("vk_gecmis");
      return saved?JSON.parse(saved):[];
    }catch(e){return [];}
  });
  const [settings,setSettings]=useState(()=>{
    try{
      const saved=localStorage.getItem("vk_settings");
      return saved?{...DEFAULT_SETTINGS,...JSON.parse(saved)}:DEFAULT_SETTINGS;
    }catch(e){return DEFAULT_SETTINGS;}
  });
  const [saved,setSaved]=useState(false);
  const [bildirimAcik,setBildirimAcik]=useState(false);
  const [secilikur,setSeciliKur]=useState<any>(null);
  const [hakkindaAcik,setHakkindaAcik]=useState(false);
  const [kurulumKilavuzuAcik,setKurulumKilavuzuAcik]=useState(false);
  const [homeTab,setHomeTab]=useState<"hesapla"|"piyasa">("hesapla");

  const handleSave=(s)=>{
    setSettings(s);
    try{localStorage.setItem("vk_settings",JSON.stringify(s));}catch(e){}
    setSaved(true);setTimeout(()=>{setSaved(false);setScreen("home");},1200);
  };
  const [saat, setSaat] = useState(()=>new Date());
  useEffect(()=>{
    const t = setInterval(()=>setSaat(new Date()), 1000);
    return ()=>clearInterval(t);
  },[]);

  const saatStr = saat.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const tarihStr = saat.toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  const nav=(sc)=>setScreen(sc);
  const back=()=>{const b=MENU[screen]?.back;if(b)setScreen(b);};
  const meta=MENU[screen];

  return(
    <>
      <style>{`
        html, body, #root { margin:0; padding:0; background:#0F1923; min-height:100dvh; min-height:100vh; }
        body { overscroll-behavior-y: none; }
        input:focus, textarea:focus, select:focus {
          border-color: #5B9BD8 !important;
          box-shadow: 0 0 0 3px rgba(91,155,216,0.25);
          caret-color: #5B9BD8;
        }
        .piyasa-scroll::-webkit-scrollbar { display:none; }
        .piyasa-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif",background:"#0F1923",minHeight:"100dvh",maxWidth:430,margin:"0 auto"}}>
      {/* header */}
      <div style={{background:"#0F1923",padding:"44px 20px 20px"}}>
        {screen==="home"?(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,margin:"0 0 12px"}}>
              <img src={KATILIM_LOGO_B64} alt="" style={{height:26,width:"auto",display:"block",flexShrink:0}}/>
              <span style={{fontSize:19,fontWeight:700,letterSpacing:"-0.005em",fontFamily:"Georgia,'Iowan Old Style','Times New Roman',serif",background:"linear-gradient(100deg,#EAF1FA 0%,#C9D9EE 60%,#B8C9E8 100%)",WebkitBackgroundClip:"text",backgroundClip:"text",color:"transparent"} as any}>Katılım Analiz</span>
              <span style={{fontSize:7,fontWeight:800,color:"#5B9BD8",background:"rgba(91,155,216,0.15)",border:"1px solid rgba(91,155,216,0.35)",borderRadius:5,padding:"1.5px 4px",letterSpacing:"0.03em",marginLeft:1}}>PRO</span>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <div style={{display:"flex",gap:6,marginBottom:4}}>
                  <div onClick={()=>setBildirimAcik(true)} style={{flex:1,background:"rgba(255,193,7,0.2)",border:"1px solid rgba(255,193,7,0.6)",borderRadius:8,padding:"6px 10px",cursor:"pointer"}}>
                    <p style={{margin:0,fontSize:10,fontWeight:700,color:"#FFD60A",textAlign:"center"}}>⚠️ TEST AŞAMASINDADIR</p>
                    <p style={{margin:"2px 0 0",fontSize:9,color:"rgba(255,255,255,0.7)",textAlign:"center"}}>Hata ve önerilerinizi buradan bildirebilirsiniz</p>
                  </div>
                  <div style={{flex:1,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"6px 10px"}}>
                    <p style={{margin:0,fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.9)",textAlign:"center"}}>📋 YASAL UYARI</p>
                    <p style={{margin:"2px 0 0",fontSize:9,color:"rgba(255,255,255,0.65)",textAlign:"center",lineHeight:1.3}}>Bilgilendirme amaçlıdır, hukuki sonuç doğurmaz</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Tarih & Saat */}
            <div style={{background:"rgba(255,255,255,0.07)",borderRadius:10,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.6)",textTransform:"capitalize"}}>{tarihStr}</p>
              <p style={{margin:0,fontSize:15,fontWeight:700,color:"#fff",fontFamily:"monospace",letterSpacing:"0.05em"}}>{saatStr}</p>
            </div>

            {/* ── ANA MENÜ ARAMA ── */}
            {(()=>{
              const menuSonuclar=menuAramaQ.trim().length>1
                ?MENU_ARAMA_LIST.filter(m=>m.label.toUpperCase().includes(menuAramaQ.toUpperCase())||m.grup.toUpperCase().includes(menuAramaQ.toUpperCase()))
                :[];
              return(
                <div style={{marginBottom:10,position:"relative"}}>
                  <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.07)",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",padding:"0 12px"}}>
                    <span style={{fontSize:14,color:"rgba(255,255,255,0.4)",marginRight:8}}>🔍</span>
                    <input
                      value={menuAramaQ}
                      onChange={e=>setMenuAramaQ(e.target.value)}
                      placeholder="Menülerde ara…"
                      style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:13,padding:"10px 0"} as any}
                    />
                    {menuAramaQ&&<span onClick={()=>setMenuAramaQ("")} style={{fontSize:16,color:"rgba(255,255,255,0.4)",cursor:"pointer",padding:"0 4px"}}>✕</span>}
                  </div>
                  {menuSonuclar.length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#1A2633",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",marginTop:4,maxHeight:260,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
                      {menuSonuclar.map((m,i)=>(
                        <div key={m.key} onClick={()=>{nav(m.key);setMenuAramaQ("");}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:i<menuSonuclar.length-1?"1px solid rgba(255,255,255,0.07)":"none",cursor:"pointer"}}
                          onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.05)")}
                          onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                          <span style={{fontSize:16,flexShrink:0}}>{m.icon}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,color:"#e8f0fa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.label}</div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:1}}>{m.grup}</div>
                          </div>
                          <span style={{fontSize:12,color:"rgba(255,255,255,0.25)",flexShrink:0}}>›</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {menuAramaQ.trim().length>1&&menuSonuclar.length===0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#1A2633",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",marginTop:4,padding:"14px",textAlign:"center"}}>
                      <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>Sonuç bulunamadı</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Finansal Takvim - Bugün uyarısı kayan yazı */}
            {(()=>{
              const bugun=new Date(); bugun.setHours(0,0,0,0);
              const zkStart=new Date(2026,5,19);
              const zkT:Date[]=[]; for(let i=0;i<40;i++){const t=new Date(zkStart);t.setDate(zkStart.getDate()+i*14);if(t.getFullYear()>2027)break;zkT.push(t);}
              const PPK=[new Date(2026,0,22),new Date(2026,2,12),new Date(2026,3,22),new Date(2026,5,11),new Date(2026,6,23),new Date(2026,8,10),new Date(2026,9,22),new Date(2026,11,10)];
              const FED=[new Date(2026,0,28),new Date(2026,2,18),new Date(2026,3,29),new Date(2026,5,17),new Date(2026,6,29),new Date(2026,8,16),new Date(2026,9,28),new Date(2026,11,9)];
              const tlStart=new Date(2026,6,3);
              const tlT:Date[]=[]; for(let i=0;i<20;i++){const t=new Date(tlStart);t.setDate(tlStart.getDate()+i*56);if(t.getFullYear()>2027)break;tlT.push(t);}
              const krStart=new Date(2026,6,17);
              const krT:Date[]=[]; for(let i=0;i<20;i++){const t=new Date(krStart);t.setDate(krStart.getDate()+i*56);if(t.getFullYear()>2027)break;krT.push(t);}
              const tumEvents=[
                ...PPK.map(t=>({tarih:t,label:"PPK Toplantısı",icon:"🏛️"})),
                ...FED.map(t=>({tarih:t,label:"FED (FOMC) Faiz Kararı",icon:"🇺🇸"})),
                ...zkT.map(t=>({tarih:t,label:"ZK Hesaplama",icon:"📊"})),
                ...tlT.map(t=>({tarih:t,label:"TL Payı Rasyo Hesaplama",icon:"📈"})),
                ...krT.map(t=>({tarih:t,label:"Kredi Büyüme Hesaplama",icon:"💳"})),
              ];
              const bugunEtk=tumEvents.filter(e=>{const d=new Date(e.tarih);d.setHours(0,0,0,0);return d.getTime()===bugun.getTime();});
              // Vade takibi kayıtlarını da ekle
              let vadeEtk:any[]=[];
              try{
                const vs=localStorage.getItem("katilimAnaliz_vadeTakibi_v1");
                if(vs){
                  const vk=JSON.parse(vs);
                  vadeEtk=vk.filter((k:any)=>{
                    const f=vtBugunFark(k.vade);
                    return f>=0&&f<=k.hatirlatmaGun;
                  }).map((k:any)=>({icon:VT_TIP_ICON[k.tip]||"⏰",label:k.baslik}));
                }
              }catch{}
              const tumBugunEtk=[...bugunEtk,...vadeEtk];
              if(tumBugunEtk.length===0) return null;
              const metin=tumBugunEtk.map((e:any)=>`${e.icon} ${e.label}`).join("   •   ");
              const tekrar=`${metin}   •   ${metin}   •   `;
              return(
                <div style={{marginTop:5,overflow:"hidden",borderRadius:8,background:"rgba(184,50,50,0.15)",border:"1px solid rgba(184,50,50,0.35)",padding:"5px 0"}}>
                  <style>{`@keyframes takvimTicker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}.takvim-ticker{display:inline-flex;animation:takvimTicker 18s linear infinite;white-space:nowrap;}`}</style>
                  <div className="takvim-ticker">
                    {[tekrar,tekrar].map((t,i)=>(
                      <span key={i} style={{fontSize:11,fontWeight:700,color:"#FF9999",paddingRight:40}}>{t}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        ):(
          <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
            <button onClick={back} style={{background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",fontWeight:600,fontSize:14,cursor:"pointer",padding:"7px 12px",borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:16}}>‹</span><span>Geri</span>
            </button>
            <span style={{fontSize:15,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>{meta?.title}</span>
          </div>
        )}
      </div>

      {bildirimAcik&&<BildirimModal onClose={()=>setBildirimAcik(false)}/>}
      {secilikur&&<KurGrafikModal kur={secilikur} onClose={()=>setSeciliKur(null)}/>}
      {hakkindaAcik&&<HakkindaModal onClose={()=>setHakkindaAcik(false)}/>}
      {kurulumKilavuzuAcik&&<KurulumKilavuzuModal onClose={()=>setKurulumKilavuzuAcik(false)}/>}
      {favoriDuzenleAcik&&<FavoriDuzenleModal favoriler={favoriler} onToggle={(key)=>setFavoriler(f=>f.includes(key)?f.filter(k=>k!==key):[...f,key])} onClose={()=>setFavoriDuzenleAcik(false)}/>}
      {saved&&<div style={{position:"fixed",top:64,left:"50%",transform:"translateX(-50%)",background:"#1C3A5E",color:"#fff",borderRadius:20,padding:"10px 20px",fontSize:14,fontWeight:600,zIndex:100}}>✓ Ayarlar kaydedildi</div>}

      <div style={{paddingTop:0}}>

        {/* ── HOME ── */}
        {screen==="home"&&(
          <div style={{background:"#0F1923",padding:"10px 12px 0",paddingBottom:92,boxSizing:"border-box",display:"flex",flexDirection:"column",overflowY:"auto"}}>

            {/* Piyasa Özeti */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:0.5}}>Piyasa Özeti</span>
              <span onClick={()=>nav("piyasaMenu")} style={{fontSize:11,fontWeight:700,color:"#3B82F6",cursor:"pointer"}}>Tümü ›</span>
            </div>
            <div className="piyasa-scroll" style={{display:"flex",overflowX:"auto",gap:6,marginBottom:14,scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
              {[
                {ad:"USD/TRY",  sembol:"USDTRY=X",   dec:2, kod:"USD"},
                {ad:"EUR/TRY",  sembol:"EURTRY=X",   dec:2, kod:"EUR"},
                {ad:"GBP/TRY",  sembol:"GBPTRY=X",   dec:2, kod:"GBP"},
                {ad:"ALTIN/GR", sembol:"GRAM_ALTIN", dec:2, kod:"Altın/TRY (Gram)"},
                {ad:"BIST 100", sembol:"XU100.IS",   dec:0, kod:"BIST 100"},
                {ad:"BITCOIN",  sembol:"BTC-USD",    dec:0, kod:"Bitcoin"},
                {ad:"ETHEREUM", sembol:"ETH-USD",    dec:2, kod:"Ethereum"},
                {ad:"GÜMÜŞ",    sembol:"SI=F",       dec:2, kod:"Gümüş (Ons)"},
                {ad:"BRENT",    sembol:"BZ=F",       dec:2, kod:"Brent Petrol"},
                {ad:"S&P 500",  sembol:"^GSPC",      dec:2, kod:"S&P 500"},
              ].map(k=>(
                <div key={k.sembol} style={{flex:"0 0 94px",scrollSnapAlign:"start"}}>
                  <PiyasaOzetiKart ad={k.ad} sembol={k.sembol} dec={k.dec} onTikla={()=>setSeciliKur({kod:k.kod,ad:k.ad,sembol:k.sembol})}/>
                </div>
              ))}
            </div>

            {/* Favorilerim */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:0.5}}>Favorilerim</span>
              <span onClick={()=>setFavoriDuzenleAcik(true)} style={{fontSize:11,fontWeight:700,color:"#3B82F6",cursor:"pointer"}}>Düzenle</span>
            </div>
            <div className="piyasa-scroll" style={{display:"flex",overflowX:"auto",gap:8,marginBottom:14,scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
              {favoriler.map(key=>{
                const item=HESAPLA_ARAC_LISTESI.find(h=>h.key===key);
                if(!item) return null;
                return(
                  <div key={key} onClick={()=>nav(item.key)} style={{
                    flex:"0 0 94px",scrollSnapAlign:"start",
                    background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:14,padding:"14px 6px",cursor:"pointer",minHeight:104,
                    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,
                  }}>
                    <div style={{width:48,height:48,borderRadius:24,background:"rgba(59,130,246,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{item.icon}</div>
                    <span style={{fontSize:10.5,fontWeight:700,color:"#E8F0FA",textAlign:"center",lineHeight:1.25}}>{item.label}</span>
                  </div>
                );
              })}
              {favoriler.length===0&&(
                <div onClick={()=>setFavoriDuzenleAcik(true)} style={{flex:"1 0 auto",textAlign:"center",padding:"16px 0",color:"rgba(255,255,255,0.35)",fontSize:12,cursor:"pointer"}}>
                  Henüz favori eklemedin — eklemek için dokun
                </div>
              )}
            </div>

            {/* Piyasalar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:0.5}}>Piyasalar</span>
              <span onClick={()=>nav("piyasaMenu")} style={{fontSize:11,fontWeight:700,color:"#3B82F6",cursor:"pointer"}}>Tümü ›</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
              {[
                {key:"bistHisseTarayici", icon:"📊", label:"BİST Hisse Veri İzleme"},
                {key:"fonGetiriIzleme",   icon:"📈", label:"Yatırım Fonları Getiri İzleme"},
                {key:"piyasaHaberleri",   icon:"📡", label:"Piyasa Haberleri"},
                {key:"finansalTakvim",    icon:"📅", label:"Finansal Takvim"},
              ].map(c=>(
                <div key={c.key} onClick={()=>nav(c.key)} style={{
                  background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:14,padding:"14px 6px",cursor:"pointer",minHeight:104,
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,
                }}>
                  <div style={{width:48,height:48,borderRadius:24,background:"rgba(74,222,128,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{c.icon}</div>
                  <span style={{fontSize:10.5,fontWeight:700,color:"#E8F0FA",textAlign:"center",lineHeight:1.25}}>{c.label}</span>
                </div>
              ))}
            </div>

            {/* Son Haberler — en yeni 3 haber */}
            {sonHaberler.length>0&&(
              <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:0.5}}>Son Haberler</span>
                  <span onClick={()=>nav("piyasaHaberleri")} style={{fontSize:11,fontWeight:700,color:"#3B82F6",cursor:"pointer"}}>Tümü ›</span>
                </div>
                <div style={{marginBottom:14}}>
                  {sonHaberler.map((h,i)=>{
                    const farkDk=Math.round((Date.now()-new Date(h.tarih).getTime())/60000);
                    const zamanEtiket = farkDk<1?"az önce":farkDk<60?`${farkDk} dk önce`:farkDk<1440?`${Math.round(farkDk/60)} sa önce`:new Date(h.tarih).toLocaleDateString("tr-TR",{day:"numeric",month:"short"});
                    return(
                      <a key={h.link||i} href={h.link} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
                        <div style={{
                          display:"flex",alignItems:"flex-start",gap:10,
                          background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                          borderLeft:"3px solid #FF6B35",borderRadius:12,padding:"11px 13px",marginBottom:8,
                        }}>
                          <span style={{fontSize:15,flexShrink:0,marginTop:1}}>📡</span>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{margin:0,fontSize:12.5,fontWeight:700,color:"#E8F0FA",lineHeight:1.4}}>{h.baslik}</p>
                            <p style={{margin:"4px 0 0",fontSize:10,color:"rgba(255,255,255,0.4)"}}>🕐 {zamanEtiket}</p>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </>
            )}

            {/* Copyright — alt banda yapışık */}
            <p style={{margin:"auto 0 0",padding:"10px 0 4px",fontSize:10,color:"rgba(255,255,255,0.15)",textAlign:"center"}}>
              © 2026 Katılım Analiz · Tüm hakları saklıdır.
            </p>
          </div>
        )}

        {/* ── HESAPLA (alt bar sekmesi) ── */}
        {screen==="hesaplaMenu"&&(()=>{
          const aramaQ=hesaplaAramaQ.trim().toUpperCase();
          const filtreliListe=HESAPLA_ARAC_LISTESI.filter(it=>
            (hesaplaFiltre==="tumu"||it.kat===hesaplaFiltre)&&
            (aramaQ===""||it.label.toUpperCase().includes(aramaQ))
          );
          return(
          <div style={{background:"#0F1923",padding:"12px 12px 0",paddingBottom:92,boxSizing:"border-box",overflowY:"auto"}}>
            {/* Arama çubuğu */}
            <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.07)",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",padding:"0 12px",marginBottom:10}}>
              <span style={{fontSize:14,color:"rgba(255,255,255,0.4)",marginRight:8}}>🔍</span>
              <input
                value={hesaplaAramaQ}
                onChange={e=>setHesaplaAramaQ(e.target.value)}
                placeholder="Araç ara…"
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:13,padding:"10px 0"} as any}
              />
              {hesaplaAramaQ&&<span onClick={()=>setHesaplaAramaQ("")} style={{fontSize:16,color:"rgba(255,255,255,0.4)",cursor:"pointer",padding:"0 4px"}}>✕</span>}
            </div>

            {/* Kategori filtre çipleri */}
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14}}>
              {HESAPLA_KATEGORILER.map(k=>{
                const aktif=hesaplaFiltre===k.id;
                return (
                  <div key={k.id} onClick={()=>setHesaplaFiltre(k.id)} style={{
                    flexShrink:0,padding:"7px 14px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap",
                    background:aktif?"#3B82F6":"rgba(255,255,255,0.07)",
                    border:aktif?"1px solid #3B82F6":"1px solid rgba(255,255,255,0.1)",
                    fontSize:12,fontWeight:700,color:aktif?"#fff":"rgba(255,255,255,0.6)",
                  }}>{k.label}</div>
                );
              })}
            </div>

            {/* Kategori başlıklı liste */}
            {HESAPLA_KATEGORILER.filter(k=>k.id!=="tumu").map(kat=>{
              const items=filtreliListe.filter(it=>it.kat===kat.id);
              if(items.length===0) return null;
              return (
                <div key={kat.id} style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:800,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>{kat.baslik||`${kat.label} Hesaplamaları`}</div>
                  {items.map(it=>(
                    <div key={it.key} onClick={()=>nav(it.key)} style={{
                      display:"flex",alignItems:"center",gap:12,
                      background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",
                      borderRadius:12,padding:"13px 14px",marginBottom:8,cursor:"pointer",
                    }}>
                      <span style={{fontSize:18,width:26,textAlign:"center",flexShrink:0}}>{it.icon}</span>
                      <span style={{flex:1,fontSize:14,fontWeight:600,color:"#E8F0FA"}}>{it.label}</span>
                      <span style={{color:"rgba(255,255,255,0.3)",fontSize:18,flexShrink:0}}>›</span>
                    </div>
                  ))}
                </div>
              );
            })}

            {filtreliListe.length===0&&(
              <div style={{textAlign:"center",padding:"40px 0",color:"rgba(255,255,255,0.35)",fontSize:13}}>Sonuç bulunamadı</div>
            )}
          </div>
          );
        })()}

        {/* ── PİYASA (alt bar sekmesi) ── */}
        {screen==="piyasaMenu"&&(()=>{
          const aramaQ=piyasaTabloAramaQ.trim().toUpperCase();
          const satirlar=(PIYASA_TABLO_VERISI[piyasaTabloFiltre]||[]).filter((r:any)=>
            aramaQ===""||r.ad.toUpperCase().includes(aramaQ)
          );
          return(
          <div style={{background:"#0F1923",padding:"12px 12px 0",paddingBottom:92,boxSizing:"border-box",overflowY:"auto"}}>
            {/* Arama çubuğu */}
            <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.07)",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",padding:"0 12px",marginBottom:10}}>
              <span style={{fontSize:14,color:"rgba(255,255,255,0.4)",marginRight:8}}>🔍</span>
              <input
                value={piyasaTabloAramaQ}
                onChange={e=>setPiyasaTabloAramaQ(e.target.value)}
                placeholder="Piyasa ara…"
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:13,padding:"10px 0"} as any}
              />
              {piyasaTabloAramaQ&&<span onClick={()=>setPiyasaTabloAramaQ("")} style={{fontSize:16,color:"rgba(255,255,255,0.4)",cursor:"pointer",padding:"0 4px"}}>✕</span>}
            </div>

            {/* Kategori filtre çipleri */}
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:6}}>
              {PIYASA_TABLO_KATEGORILER.map(k=>{
                const aktif=piyasaTabloFiltre===k.id;
                return (
                  <div key={k.id} onClick={()=>setPiyasaTabloFiltre(k.id)} style={{
                    flexShrink:0,padding:"7px 16px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap",
                    background:aktif?"#3B82F6":"rgba(255,255,255,0.07)",
                    border:aktif?"1px solid #3B82F6":"1px solid rgba(255,255,255,0.1)",
                    fontSize:12,fontWeight:700,color:aktif?"#fff":"rgba(255,255,255,0.6)",
                  }}>{k.label}</div>
                );
              })}
            </div>

            {piyasaTabloFiltre==="fonlar"?(
              <div onClick={()=>nav("fonGetiriIzleme")} style={{
                background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:14,padding:"16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",marginTop:8,
              }}>
                <span style={{fontSize:22}}>📈</span>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:13,fontWeight:800,color:"#fff"}}>Yatırım Fonları Getiri İzleme</p>
                  <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.45)"}}>Tüm fonları getiri sırasına göre incele</p>
                </div>
                <span style={{color:"rgba(255,255,255,0.3)",fontSize:18}}>›</span>
              </div>
            ):piyasaTabloFiltre==="gostergeler"?(()=>{
              const apifon=evdsMakro?.["TP.APIFON4"];
              const tufY=evdsMakro?.["TUFE_YILLIK"];
              const tufA=evdsMakro?.["TUFE_AYLIK"];
              const tltefk=evdsMakro?.["TP.BISTTLREF.KAPANIS"];
              const fmtPct=(v:any)=>v?.deger!=null?`%${parseFloat(v.deger).toFixed(2).replace(".",",")}`:"—";
              const GOSTERGELER=[
                {ad:"TCMB Politika Faizi", deger:fmtPct(apifon), tarih:apifon?.tarih||"Haziran 2026", canli:apifon!=null},
                {ad:"TCMB Üst Bant",       deger:"%40,00", tarih:"Haziran 2026"},
                {ad:"TCMB Alt Bant",       deger:"%34,00", tarih:"Haziran 2026"},
                {ad:"TÜFE (Yıllık)",       deger:fmtPct(tufY), tarih:tufY?.tarih||"", canli:tufY!=null},
                {ad:"TÜFE (Aylık)",        deger:fmtPct(tufA), tarih:tufA?.tarih||"", canli:tufA!=null},
                {ad:"TLTEFK (BIST-TLREF)", deger:tltefk?.deger!=null?`%${tltefk.deger.toFixed(2).replace(".",",")}`:"—", tarih:tltefk?.tarih||"EVDS", canli:tltefk!=null},
                {ad:"Türkiye 5Y CDS",      deger:"~250 bps", tarih:"Haziran 2026"},
              ];
              return(
                <div>
                  <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden",marginTop:8}}>
                    {GOSTERGELER.map((g,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:i<GOSTERGELER.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
                        <div>
                          <p style={{margin:0,fontSize:12,fontWeight:600,color:"#E8F0FA"}}>{g.ad}</p>
                          {g.tarih&&<p style={{margin:"1px 0 0",fontSize:9,color:"rgba(255,255,255,0.3)"}}>{g.tarih}{g.canli?" · canlı":""}</p>}
                        </div>
                        <span style={{fontSize:13,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{g.deger}</span>
                      </div>
                    ))}
                  </div>
                  <div onClick={()=>nav("finansalGostergeler")} style={{
                    display:"flex",alignItems:"center",gap:10,marginTop:10,padding:"12px 14px",
                    background:"rgba(255,255,255,0.04)",borderRadius:12,cursor:"pointer",
                  }}>
                    <span style={{fontSize:16}}>📉</span>
                    <span style={{flex:1,fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>Detaylı Görünüm (SOFR, EURIBOR, CDS, canlı kur şeridi...)</span>
                    <span style={{color:"rgba(255,255,255,0.3)",fontSize:16}}>›</span>
                  </div>
                </div>
              );
            })():(
              <>
                {/* Tablo başlığı */}
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 4px 6px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
                  <span style={{flex:1,fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>Sembol</span>
                  <span style={{width:78,textAlign:"right",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>Son</span>
                  <span style={{width:60,textAlign:"right",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>Günlük %</span>
                  <span style={{width:56,textAlign:"right",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>Grafik</span>
                </div>
                {satirlar.map((r:any)=>(
                  <PiyasaSatiri key={r.sembol} ad={r.ad} sembol={r.sembol} dec={r.dec} paraOnek={r.paraOnek}
                    onTikla={()=>setSeciliKur({kod:r.ad,ad:r.ad,sembol:r.sembol})}/>
                ))}
                {satirlar.length===0&&(
                  <div style={{textAlign:"center",padding:"30px 0",color:"rgba(255,255,255,0.35)",fontSize:13}}>Sonuç bulunamadı</div>
                )}
                {piyasaTabloFiltre==="borsa"&&(
                  <div onClick={()=>nav("bistHisseTarayici")} style={{
                    background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:14,padding:"16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",marginTop:10,
                  }}>
                    <span style={{fontSize:22}}>📊</span>
                    <div style={{flex:1}}>
                      <p style={{margin:0,fontSize:13,fontWeight:800,color:"#fff"}}>BİST Hisse Veri İzleme</p>
                      <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.45)"}}>Hisse bazında canlı fiyat ve grafik takibi</p>
                    </div>
                    <span style={{color:"rgba(255,255,255,0.3)",fontSize:18}}>›</span>
                  </div>
                )}
              </>
            )}
          </div>
          );
        })()}

        {/* ── ARAÇLAR (alt bar sekmesi) ── */}
        {screen==="araclarMenu"&&(
          <div style={{background:"#0F1923",padding:"12px 12px 0",paddingBottom:92,boxSizing:"border-box",overflowY:"auto"}}>
            {[
              {key:"vadeTakibi", icon:"⏰", label:"Vade Takip & Hatırlatma Ajandam", desc:"Finansman ve ödeme vadelerini takip et, hatırlatma al", renk:"#4ADE80", bg:"rgba(74,222,128,0.15)"},
              {key:"sozluk",     icon:"📖", label:"Katılım Bankacılığı Sözlüğü",     desc:"Terim ve tanımları hızlıca ara", renk:"#60A5FA", bg:"rgba(96,165,250,0.15)"},
            ].map(c=>(
              <div key={c.key} onClick={()=>nav(c.key)} style={{
                display:"flex",alignItems:"center",gap:14,
                background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:14,padding:"14px 16px",marginBottom:10,cursor:"pointer",
              }}>
                <div style={{width:46,height:46,borderRadius:12,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,flexShrink:0}}>{c.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:14,fontWeight:800,color:"#fff"}}>{c.label}</p>
                  <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.45)"}}>{c.desc}</p>
                </div>
                <span style={{color:"rgba(255,255,255,0.3)",fontSize:20,flexShrink:0}}>›</span>
              </div>
            ))}
          </div>
        )}

        {/* ── PROFİL (alt bar sekmesi) ── */}
        {screen==="profil"&&(
          <div style={{background:"#0F1923",padding:"12px 12px 0",paddingBottom:92,boxSizing:"border-box",overflowY:"auto"}}>

            {/* Hızlı erişim */}
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Hesap</div>
            {[
              {icon:"⚙️", label:"Ayarlar", onClick:()=>nav("ayarlar")},
              {icon:"📲", label:"Ana Ekrana Ekleme Kılavuzu", onClick:()=>setKurulumKilavuzuAcik(true)},
              {icon:"ℹ️", label:"Hakkında", onClick:()=>setHakkindaAcik(true)},
              {icon:"📣", label:"Hata & Öneri Bildir", onClick:()=>setBildirimAcik(true)},
            ].map((r,i)=>(
              <div key={i} onClick={r.onClick} style={{
                display:"flex",alignItems:"center",gap:12,
                background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:12,padding:"13px 14px",marginBottom:8,cursor:"pointer",
              }}>
                <span style={{fontSize:17,width:24,textAlign:"center",flexShrink:0}}>{r.icon}</span>
                <span style={{flex:1,fontSize:14,fontWeight:600,color:"#E8F0FA"}}>{r.label}</span>
                <span style={{color:"rgba(255,255,255,0.3)",fontSize:18,flexShrink:0}}>›</span>
              </div>
            ))}

            {/* İletişim */}
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:0.5,margin:"14px 0 8px"}}>İletişim</div>
            <a href="mailto:katilimanalizz@gmail.com" style={{display:"flex",alignItems:"center",gap:12,textDecoration:"none",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"13px 14px",marginBottom:8}}>
              <span style={{fontSize:17,width:24,textAlign:"center",flexShrink:0}}>📧</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.4)"}}>E-Posta</p>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:"#E8F0FA",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>katilimanalizz@gmail.com</p>
              </div>
            </a>
            <a href="https://www.linkedin.com/in/u%C4%9Fur-yilmaz-62194b168" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:12,textDecoration:"none",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"13px 14px",marginBottom:8}}>
              <span style={{fontSize:17,width:24,textAlign:"center",flexShrink:0}}>💼</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.4)"}}>LinkedIn</p>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:"#E8F0FA"}}>Uğur YILMAZ</p>
              </div>
            </a>

            <p style={{margin:"16px 0 0",fontSize:10,color:"rgba(255,255,255,0.15)",textAlign:"center"}}>Katılım Analiz · v1.3.0</p>
          </div>
        )}

        {/* ── EKRANLAR ── */}
        {screen==="vadeliKatilim"&&<VadeliKatilim s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="kasaOranAnalizi"&&<KasaOranAnalizi/>}
        {screen==="verimlilikAnalizi"&&<VerimlilikAnalizi s={settings}/>
        }
        {screen==="fonGetiriIzleme"&&<FonGetiriIzleme settings={settings}/>}
        {screen==="bistHisseTarayici"&&<BistHisseTarayici/>}
        {screen==="getiridenAnapara"&&<GetiridenAnapara s={settings}/>}
        {screen==="oranAnalizi"&&<OranAnalizi s={settings}/>}
        {screen==="tahvilBono"&&<TahvilBono s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="konutFinansman"&&<KonutFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="tasitFinansman"&&<TasitFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="yatirimFonuFinansman"&&<YatirimFonuFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="toggFinansman"&&<ToggFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="arsaIsyeri"&&<ArsaIsyeriFinansman s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="taksitenKredi"&&<TaksitenKredi s={settings}/>}
        {screen==="spotFinansman"&&<SpotKredi s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="taksitliTicari"&&<TaksitliTicariFinansman s={settings}/>}
        {screen==="katkiPayi"&&<KatkiPayiHesaplama/>}
        {screen==="leasing"&&<Leasing s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="posHesaplama"&&<PosHesaplama s={settings}/>}
        {screen==="tmKomisyon"&&<TmKomisyon/>}
        {screen==="akreditifKomisyon"&&<AkreditifKomisyon/>}
        {screen==="soikReeskont"&&<SoikReeskontHesaplama s={settings} onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="esnekOdemePlanlari"&&<EsnekOdemePlanlari nav={nav}/>}
        {screen==="esitAnapara"&&<EsitAnapara onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="araOdemeli"&&<AraOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="artanOdemeli"&&<ArtanOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="azalanOdemeli"&&<AzalanOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="balonOdemeli"&&<BalonOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="esnekOdemeli"&&<EsnekOdemeli onGecmis={k=>gecmisKaydet(gecmis,setGecmis,k)}/>}
        {screen==="asistan"&&<Asistan nav={nav}/>}
        {screen==="sozluk"&&<Sozluk/>}
        {screen==="gecmis"&&<Gecmis gecmis={gecmis} onTemizle={()=>{setGecmis([]);try{localStorage.removeItem("vk_gecmis")}catch(e){}}} nav={nav}/>}
        {screen==="finansalTakvim"&&<FinansalTakvim/>}
        {screen==="vadeTakibi"&&<VadeTakibi/>}
        {screen==="hazineDoviz"&&<HtDovizDonusturucu/>}
        {screen==="hazineForward"&&<HtForwardHesaplama/>}
        {screen==="hazineSwap"&&<HtSwapHesaplama/>}
        {screen==="hazineBono"&&<HtHazineBonosu/>}
        {screen==="hazineSenaryo"&&<HtKurSenaryo/>}
        {screen==="piyasaHaberleri"&&<PiyasaHaberleri/>}
        {screen==="finansalGostergeler"&&<FinansalGostergeler onKurTikla={(k:any)=>setSeciliKur(k)}/>}
        {screen==="ayarlar"&&<Ayarlar settings={settings} onSave={handleSave}/>}

        {/* ── YASAL UYARI FOOTER ── */}
        {!["home","hesaplaMenu","piyasaMenu","araclarMenu","asistan","sozluk","finansalTakvim","finansalGostergeler","vadeTakibi","piyasaHaberleri","ayarlar","profil"].includes(screen)&&(
          <div style={{
            margin:"4px 16px 28px",
            padding:"10px 14px",
            background:"rgba(255,255,255,0.05)",
            borderRadius:10,
            borderLeft:`3px solid #B0B8C8`,
            display:"flex",gap:8,alignItems:"flex-start"
          }}>
            <span style={{fontSize:13,flexShrink:0,marginTop:1}}>⚠️</span>
            <p style={{
              margin:0,
              fontSize:11,
              color:"#6B7280",
              lineHeight:1.55,
              fontStyle:"italic"
            }}>
              Bu hesaplamalar yalnızca bilgilendirme amaçlıdır; kesin teklif, resmi belge veya hukuki taahhüt niteliği taşımaz. Nihai oranlar ve koşullar için yetkili biriminizle iletişime geçiniz.
            </p>
          </div>
        )}
      </div>

      {/* ── ALT BAR (BOTTOM TAB NAVIGATION) — Yüzen (floating) tasarım ── */}
      {["home","hesaplaMenu","piyasaMenu","araclarMenu","asistan","profil"].includes(screen)&&(
        <div style={{
          position:"fixed",left:0,right:0,bottom:0,zIndex:90,
          display:"flex",justifyContent:"center",
          padding:"0 14px",paddingBottom:"calc(14px + env(safe-area-inset-bottom,0px))",
          pointerEvents:"none",
        }}>
          <div style={{
            width:"100%",maxWidth:402,
            background:"rgba(22,34,46,0.88)",backdropFilter:"blur(24px) saturate(180%)",WebkitBackdropFilter:"blur(24px) saturate(180%)",
            border:"1px solid rgba(255,255,255,0.09)",borderRadius:26,
            display:"flex",boxShadow:"0 10px 32px rgba(0,0,0,0.45)",
            pointerEvents:"auto",
          }}>
            {ALT_BAR_SEKMELERI.map(t=>{
              const aktif=TAB_OF_SCREEN[screen]===t.tab;
              return (
                <div key={t.tab} onClick={()=>nav(t.key)} style={{
                  flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  padding:"9px 2px 8px",cursor:"pointer",
                }}>
                  <div style={{
                    display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                    padding:"3px 12px 4px",borderRadius:14,
                    background:aktif?"rgba(91,155,216,0.16)":"transparent",
                    transition:"background 0.2s ease",
                  }}>
                    <AltBarIcon tip={t.tip} aktif={aktif}/>
                    <span style={{fontSize:9,fontWeight:aktif?700:500,letterSpacing:"0.01em",color:aktif?"#5B9BD8":"rgba(255,255,255,0.45)",whiteSpace:"nowrap",transition:"color 0.2s ease"}}>{t.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default App;// placeholder
