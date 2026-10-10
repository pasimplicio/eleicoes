// Estrutura única do menu: o cabeçalho (computador) e a gaveta (celular) leem daqui.
import {
  Bank,
  Buildings,
  City,
  Columns,
  CrownSimple,
  House,
  Info,
  MapPinArea,
  MapTrifold,
  MonitorPlay,
  Users,
  UsersThree,
  type Icon,
} from '@phosphor-icons/react'
import type { Cycle } from './elections'

export interface NavItem {
  to: string
  label: string
  hint?: string
  icon: Icon
  end?: boolean
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

export type NavEntry =
  | { kind: 'link'; item: NavItem }
  | { kind: 'group'; label: string; sections: NavSection[] }

const OFFICE_META: Record<string, { icon: Icon; hint: string }> = {
  presidente: { icon: CrownSimple, hint: 'Apuração nacional e por estado' },
  governador: { icon: Buildings, hint: 'Os 26 estados e o Distrito Federal' },
  senador: { icon: Bank, hint: 'As vagas de cada estado no Senado' },
  'deputado-federal': { icon: Columns, hint: 'Câmara dos Deputados, 513 cadeiras' },
  'deputado-estadual': { icon: UsersThree, hint: 'Assembleias e Câmara Legislativa do DF' },
  prefeito: { icon: City, hint: 'Prefeituras de todo o país' },
  vereador: { icon: Users, hint: 'Câmaras municipais' },
}

export function buildNav(cycle: Cycle): NavEntry[] {
  const office = (system: 'majoritario' | 'proporcional') =>
    cycle.offices
      .filter((o) => o.system === system)
      .map<NavItem>((o) => ({
        to: `/${cycle.year}/${o.slug}`,
        label: o.name,
        hint: OFFICE_META[o.slug]?.hint,
        icon: OFFICE_META[o.slug]?.icon ?? Columns,
      }))
  const geral = cycle.kind === 'geral'

  return [
    { kind: 'link', item: { to: '/', label: 'Início', icon: House, end: true } },
    {
      kind: 'group',
      label: 'Resultados',
      sections: [
        { label: geral ? 'Nacional e estadual' : 'Executivo', items: office('majoritario') },
        { label: geral ? 'Proporcional' : 'Legislativo', items: office('proporcional') },
      ],
    },
    ...(geral
      ? ([
          {
            kind: 'group',
            label: 'Mapas',
            sections: [
              {
                items: [
                  { to: '/mapa-de-votos', label: 'Mapa de votos', hint: 'Quem venceu em cada município', icon: MapTrifold },
                  { to: '/mapa-das-secoes', label: 'Mapa das seções', hint: 'Locais de votação no mapa', icon: MapPinArea },
                ],
              },
            ],
          },
          { kind: 'link', item: { to: '/congresso', label: 'Congresso', hint: 'Câmara, Senado e governadores', icon: Columns } },
        ] satisfies NavEntry[])
      : []),
    {
      kind: 'group',
      label: 'Sobre',
      sections: [
        {
          items: [
            { to: '/sobre', label: 'Sobre e metodologia', hint: 'De onde vêm os números', icon: Info },
            { to: '/telao', label: 'Modo telão', hint: 'Resultados em tela cheia', icon: MonitorPlay },
          ],
        },
      ],
    },
  ]
}

/** O grupo fica marcado como ativo quando a página atual é um dos seus itens. */
export function groupIsActive(sections: NavSection[], pathname: string) {
  return sections.some((s) => s.items.some((i) => pathname === i.to || pathname.startsWith(i.to + '/')))
}
