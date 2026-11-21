type Props = {
	title: string;
	value: string;
	description: string;
	badge?: string;
};

export default function DashboardTile({
	title,
	value,
	description,
	badge
}: Props) {
	return (
		<div className="rounded-lg flex items-center bg-slate-50 p-4 shadow-sm transition hover:shadow-md">
			<div className="flex-1">
				<span className="text-lg font-semibold">{title}</span>
			</div>
			<div className="flex-shrink-0">
				<span className="text-2xl font-bold">{value}</span>
			</div>
		</div>
	);
}
