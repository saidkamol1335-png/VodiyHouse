import { Container } from "@/components/Container";
import { Heading } from "@/components/Heading";
import { SiteBareHeader } from "@/components/SiteBareHeader";

export default function LocaleNotFound() {
  return (
    <>
      <SiteBareHeader />
      <Container as="main">
        <div className="py-24">
          <Heading level={2}>404</Heading>
        </div>
      </Container>
    </>
  );
}
