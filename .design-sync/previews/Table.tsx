import { Table, Tr, Td, Tag } from "@repo/ui";

export const Invoices = () => (
  <Table head={["Factura", "Cliente", "Estado", "Importe"]}>
    <Tr>
      <Td>FAC-2026-0006</Td>
      <Td>Familia Roca</Td>
      <Td>
        <Tag tone="danger">Vencida</Tag>
      </Td>
      <Td numeric>4.850,00 €</Td>
    </Tr>
    <Tr>
      <Td>FAC-2026-0007</Td>
      <Td>Comunidad Balmes 24</Td>
      <Td>
        <Tag tone="warn">Parcial</Tag>
      </Td>
      <Td numeric>12.320,50 €</Td>
    </Tr>
    <Tr>
      <Td>FAC-2026-0008</Td>
      <Td>Nou Local S.L.</Td>
      <Td>
        <Tag>Cobrada</Tag>
      </Td>
      <Td numeric>7.900,00 €</Td>
    </Tr>
  </Table>
);
