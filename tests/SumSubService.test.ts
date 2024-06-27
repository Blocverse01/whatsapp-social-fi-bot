import SumSubService from '@/app/SumSub/SumSubService';

describe('SumSubService', () => {
    describe('Generating KYC URL', () => {
        it('should generate a valid KYC URL', async () => {
            const url = await SumSubService.generateKycUrl('2348143100808');

            console.log({ url });

            expect(url).toContain('https://in.sumsub.com/websdk');
        });
    });
});
