/** Линии колонок на фоне (21st.dev в мокапе): пунктир по сетке контейнера, затухает сверху и снизу. */
export function BackgroundColumns() {
  return (
    <div className="bg-columns" aria-hidden="true">
      <div className="bg-columns__grid">
        {Array.from({ length: 6 }, (_, index) => (
          <i key={index} className="bg-columns__line" />
        ))}
      </div>
    </div>
  );
}
